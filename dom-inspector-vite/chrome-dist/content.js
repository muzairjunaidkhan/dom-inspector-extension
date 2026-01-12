(() => {
  // Prevent multiple instances
  if (window.__DOM_INSPECTOR__) {
    console.log('[DOM Inspector] Already initialized');
    return;
  }
  window.__DOM_INSPECTOR__ = true;

  // Lifecycle states
  const STATES = {
    IDLE: 'IDLE',
    INSPECTING: 'INSPECTING',
    SELECTED: 'SELECTED',
    CLEANING: 'CLEANING'
  };

  const S = {
    state: STATES.IDLE,
    inspecting: false,
    hoverPanel: null,
    panelContainer: null,
    inspectBtn: null,
    selectedItems: [],
    boxModelLayers: {},
    panelCollapsed: false,
    panelX: null,
    panelY: null,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    lastHoveredElement: null,
    rafId: null,
    pendingMouseEvent: null,
    gridFlexOverlays: [],
    handlers: {
      mousemove: null,
      click: null,
      keydown: null,
      scroll: null,
      drag: null,
      stopDrag: null
    }
  };

  // Default CSS values for diff
  const DEFAULT_CSS = {
    display: 'inline',
    position: 'static',
    top: 'auto',
    left: 'auto',
    right: 'auto',
    bottom: 'auto',
    width: 'auto',
    height: 'auto',
    margin: '0px',
    padding: '0px',
    border: '0px none rgb(0, 0, 0)',
    borderRadius: '0px',
    background: 'rgba(0, 0, 0, 0)',
    color: 'rgb(0, 0, 0)',
    fontSize: '16px',
    fontFamily: 'serif',
    fontWeight: '400',
    lineHeight: 'normal',
    textAlign: 'start',
    opacity: '1',
    zIndex: 'auto',
    overflow: 'visible',
    cursor: 'auto',
    boxShadow: 'none',
    transform: 'none',
    transition: 'all 0s ease 0s'
  };

  /* ---------------- UTILS ---------------- */
  const remove = (el) => {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  };

  const isValidState = () => {
    return window.__DOM_INSPECTOR__ && S.state !== STATES.CLEANING;
  };

  const setState = (newState) => {
    console.log(`[DOM Inspector] ${S.state} → ${newState}`);
    S.state = newState;
  };

  const isNonDefaultCSS = (prop, value) => {
    if (!value || value === 'none' || value === 'auto') return false;
    const defaultValue = DEFAULT_CSS[prop];
    if (!defaultValue) return true;
    
    // Normalize values for comparison
    const normalizedValue = value.trim();
    const normalizedDefault = defaultValue.trim();
    
    if (normalizedValue === normalizedDefault) return false;
    
    // Special cases
    if (prop === 'margin' || prop === 'padding') {
      return normalizedValue !== '0px';
    }
    if (prop === 'border') {
      return !normalizedValue.startsWith('0px');
    }
    
    return true;
  };

  const getElementPath = (el) => {
    const path = [];
    let current = el;
    
    while (current && current !== document.body && path.length < 10) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('di-'));
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }
      
      // Add nth-child for specificity
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    if (current === document.body) {
      path.unshift('body');
    }
    
    return path;
  };

  const cssText = (d) => `
${d.selector} {
  width: ${d.width};
  height: ${d.height};
  margin: ${d.margin};
  padding: ${d.padding};
  display: ${d.display};
  position: ${d.position};
  top: ${d.top};
  left: ${d.left};
  right: ${d.right};
  bottom: ${d.bottom};
  z-index: ${d.zIndex};
  color: ${d.color};
  background: ${d.background};
  opacity: ${d.opacity};
  font-size: ${d.fontSize};
  font-family: ${d.fontFamily};
  font-weight: ${d.fontWeight};
  line-height: ${d.lineHeight};
  text-align: ${d.textAlign};
  letter-spacing: ${d.letterSpacing};
  text-transform: ${d.textTransform};
  text-decoration: ${d.textDecoration};
  border: ${d.border};
  border-radius: ${d.borderRadius};
  box-shadow: ${d.boxShadow};
  outline: ${d.outline};
  flex-direction: ${d.flexDirection};
  justify-content: ${d.justifyContent};
  align-items: ${d.alignItems};
  flex-wrap: ${d.flexWrap};
  gap: ${d.gap};
  grid-template-columns: ${d.gridTemplateColumns};
  grid-template-rows: ${d.gridTemplateRows};
  grid-gap: ${d.gridGap};
  overflow: ${d.overflow};
  cursor: ${d.cursor};
  transition: ${d.transition};
  transform: ${d.transform};
}`.trim();

  const getData = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    
    let selector = el.tagName.toLowerCase();
    if (el.id) selector += "#" + el.id;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('di-'));
      if (classes.length > 0) selector += "." + classes.join(".");
    }
    
    const parseBox = (str) => {
      const parts = str.split(' ').map(p => parseFloat(p) || 0);
      if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
      if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
      if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
      return parts;
    };
    
    const marginValues = parseBox(cs.margin);
    const paddingValues = parseBox(cs.padding);
    const borderValues = parseBox(cs.borderWidth);
    
    return {
      el,
      rect: r,
      selector: selector,
      path: getElementPath(el),
      fontSize: cs.fontSize,
      color: cs.color,
      background: cs.backgroundColor,
      margin: cs.margin,
      marginValues: marginValues,
      padding: cs.padding,
      paddingValues: paddingValues,
      borderValues: borderValues,
      width: Math.round(r.width) + "px",
      height: Math.round(r.height) + "px",
      display: cs.display,
      position: cs.position,
      top: cs.top,
      left: cs.left,
      right: cs.right,
      bottom: cs.bottom,
      zIndex: cs.zIndex,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      textAlign: cs.textAlign,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      textDecoration: cs.textDecoration,
      border: cs.border,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
      outline: cs.outline,
      flexDirection: cs.flexDirection,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
      flexWrap: cs.flexWrap,
      gap: cs.gap,
      gridTemplateColumns: cs.gridTemplateColumns,
      gridTemplateRows: cs.gridTemplateRows,
      gridGap: cs.gridGap,
      opacity: cs.opacity,
      overflow: cs.overflow,
      cursor: cs.cursor,
      transition: cs.transition,
      transform: cs.transform
    };
  };

  const isInspectorElement = (el) => {
    if (!el) return false;
    return el === S.inspectBtn || 
           el === S.hoverPanel || 
           el === S.panelContainer ||
           (S.panelContainer && S.panelContainer.contains(el)) ||
           el.classList.contains('di-inspect-btn') ||
           el.classList.contains('di-hover-panel') ||
           el.classList.contains('di-selected-panel') ||
           el.classList.contains('di-selected-overlay') ||
           el.classList.contains('di-panel-item') ||
           el.classList.contains('di-button') ||
           el.classList.contains('di-box-layer') ||
           el.classList.contains('di-panel-header') ||
           el.classList.contains('di-collapse-btn') ||
           el.classList.contains('di-grid-overlay') ||
           el.classList.contains('di-flex-overlay') ||
           el.classList.contains('di-breadcrumb');
  };

  /* ---------------- GRID/FLEX VISUALIZATION ---------------- */
  function clearGridFlexOverlays() {
    S.gridFlexOverlays.forEach(overlay => remove(overlay));
    S.gridFlexOverlays = [];
  }

  function addGridOverlay(data) {
    const r = data.rect;
    const overlay = document.createElement("div");
    overlay.className = "di-grid-overlay";
    
    Object.assign(overlay.style, {
      position: "absolute",
      top: (r.top + window.scrollY) + "px",
      left: (r.left + window.scrollX) + "px",
      width: r.width + "px",
      height: r.height + "px",
      pointerEvents: "none",
      zIndex: 99998,
      border: "2px dashed rgba(147, 51, 234, 0.6)",
      background: "repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(147, 51, 234, 0.2) 19px, rgba(147, 51, 234, 0.2) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(147, 51, 234, 0.2) 19px, rgba(147, 51, 234, 0.2) 20px)"
    });
    
    document.body.appendChild(overlay);
    S.gridFlexOverlays.push(overlay);
  }

  function addFlexOverlay(data) {
    const r = data.rect;
    const cs = getComputedStyle(data.el);
    const flexDirection = cs.flexDirection;
    
    const overlay = document.createElement("div");
    overlay.className = "di-flex-overlay";
    
    Object.assign(overlay.style, {
      position: "absolute",
      top: (r.top + window.scrollY) + "px",
      left: (r.left + window.scrollX) + "px",
      width: r.width + "px",
      height: r.height + "px",
      pointerEvents: "none",
      zIndex: 99998,
      border: "2px dashed rgba(59, 130, 246, 0.6)"
    });
    
    // Add direction arrow
    const arrow = document.createElement("div");
    arrow.style.cssText = `
      position: absolute;
      color: rgba(59, 130, 246, 0.9);
      font-size: 24px;
      font-weight: bold;
      text-shadow: 0 0 4px rgba(0,0,0,0.8);
    `;
    
    if (flexDirection === 'row') {
      arrow.textContent = '→';
      arrow.style.top = '5px';
      arrow.style.left = '5px';
    } else if (flexDirection === 'row-reverse') {
      arrow.textContent = '←';
      arrow.style.top = '5px';
      arrow.style.right = '5px';
    } else if (flexDirection === 'column') {
      arrow.textContent = '↓';
      arrow.style.top = '5px';
      arrow.style.left = '5px';
    } else if (flexDirection === 'column-reverse') {
      arrow.textContent = '↑';
      arrow.style.bottom = '5px';
      arrow.style.left = '5px';
    }
    
    overlay.appendChild(arrow);
    document.body.appendChild(overlay);
    S.gridFlexOverlays.push(overlay);
  }

  /* ---------------- BOX MODEL VISUALIZATION ---------------- */
  function updateBoxModelLayers(data) {
    if (!isValidState()) return;
    
    // Remove old layers
    Object.values(S.boxModelLayers).forEach(layer => remove(layer));
    S.boxModelLayers = {};
    clearGridFlexOverlays();
    
    const r = data.rect;
    const margin = data.marginValues;
    const padding = data.paddingValues;
    const border = data.borderValues;
    
    // Margin layer (orange/tan)
    const marginLayer = document.createElement("div");
    marginLayer.className = "di-box-layer";
    Object.assign(marginLayer.style, {
      position: "absolute",
      top: (r.top + window.scrollY - margin[0]) + "px",
      left: (r.left + window.scrollX - margin[3]) + "px",
      width: (r.width + margin[1] + margin[3]) + "px",
      height: (r.height + margin[0] + margin[2]) + "px",
      background: "rgba(246, 178, 107, 0.35)",
      border: "1px solid rgba(246, 178, 107, 0.9)",
      zIndex: 99995,
      pointerEvents: "none",
      boxSizing: "border-box"
    });
    document.body.appendChild(marginLayer);
    S.boxModelLayers.margin = marginLayer;
    
    // Border layer (yellow/gold)
    const borderLayer = document.createElement("div");
    borderLayer.className = "di-box-layer";
    Object.assign(borderLayer.style, {
      position: "absolute",
      top: (r.top + window.scrollY) + "px",
      left: (r.left + window.scrollX) + "px",
      width: r.width + "px",
      height: r.height + "px",
      background: "rgba(255, 229, 153, 0.35)",
      border: "1px solid rgba(255, 229, 153, 0.9)",
      zIndex: 99996,
      pointerEvents: "none",
      boxSizing: "border-box"
    });
    document.body.appendChild(borderLayer);
    S.boxModelLayers.border = borderLayer;
    
    // Content layer (blue)
    const contentWidth = r.width - border[1] - border[3] - padding[1] - padding[3];
    const contentHeight = r.height - border[0] - border[2] - padding[0] - padding[2];
    
    if (contentWidth > 0 && contentHeight > 0) {
      const contentLayer = document.createElement("div");
      contentLayer.className = "di-box-layer";
      Object.assign(contentLayer.style, {
        position: "absolute",
        top: (r.top + window.scrollY + border[0] + padding[0]) + "px",
        left: (r.left + window.scrollX + border[3] + padding[3]) + "px",
        width: contentWidth + "px",
        height: contentHeight + "px",
        background: "rgba(139, 195, 245, 0.35)",
        border: "1px solid rgba(139, 195, 245, 0.9)",
        zIndex: 99997,
        pointerEvents: "none",
        boxSizing: "border-box"
      });
      document.body.appendChild(contentLayer);
      S.boxModelLayers.content = contentLayer;
    }
    
    // Add grid/flex overlays
    const cs = getComputedStyle(data.el);
    if (cs.display === 'grid' || cs.display === 'inline-grid') {
      addGridOverlay(data);
    } else if (cs.display === 'flex' || cs.display === 'inline-flex') {
      addFlexOverlay(data);
    }
  }

  function hideBoxModelLayers() {
    Object.values(S.boxModelLayers).forEach(layer => {
      if (layer && layer.style) layer.style.display = "none";
    });
    clearGridFlexOverlays();
  }

  /* ---------------- UI CREATION ---------------- */
  function ensureInspectButton() {
    if (S.inspectBtn) return;

    const btn = document.createElement("button");
    btn.id = "dom-inspector-btn";
    btn.className = "di-inspect-btn";
    btn.textContent = "Inspect";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: 100000,
      padding: "10px 14px",
      background: "#007acc",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "13px",
      fontWeight: "500",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      transition: "all 0.2s"
    });
    
    btn.onmouseenter = () => {
      if (S.state === STATES.IDLE) {
        btn.style.background = "#005a9e";
        btn.style.transform = "translateY(-1px)";
        btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
      }
    };
    
    btn.onmouseleave = () => {
      if (S.state === STATES.IDLE) {
        btn.style.background = "#007acc";
        btn.style.transform = "translateY(0)";
        btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      }
    };
    
    btn.onclick = (e) => {
      e.stopPropagation();
      if (S.state === STATES.IDLE || S.state === STATES.SELECTED) {
        startInspect();
      }
    };
    document.body.appendChild(btn);
    S.inspectBtn = btn;
  }

  function createBreadcrumb(path, data) {
    const breadcrumb = document.createElement("div");
    breadcrumb.className = "di-breadcrumb";
    breadcrumb.style.cssText = `
      background: rgba(40, 40, 40, 0.95);
      padding: 6px 10px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 10px;
      color: #999;
      overflow-x: auto;
      white-space: nowrap;
      backdrop-filter: blur(10px);
    `;
    
    path.forEach((segment, i) => {
      if (i > 0) {
        const separator = document.createElement("span");
        separator.textContent = " > ";
        separator.style.color = "#666";
        breadcrumb.appendChild(separator);
      }
      
      const part = document.createElement("span");
      part.textContent = segment;
      part.style.cssText = `
        color: ${i === path.length - 1 ? '#4fc3f7' : '#999'};
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 2px;
        transition: background 0.2s;
      `;
      
      part.onmouseenter = () => part.style.background = "rgba(255,255,255,0.1)";
      part.onmouseleave = () => part.style.background = "transparent";
      
      // Click to navigate to parent element
      part.onclick = (e) => {
        e.stopPropagation();
        let current = data.el;
        const stepsBack = path.length - 1 - i;
        for (let j = 0; j < stepsBack && current.parentElement; j++) {
          current = current.parentElement;
        }
        if (current && !isInspectorElement(current)) {
          const parentData = getData(current);
          updateBoxModelLayers(parentData);
          updateHoverPanel(parentData);
        }
      };
      
      breadcrumb.appendChild(part);
    });
    
    return breadcrumb;
  }

  function updateHoverPanel(data) {
    if (!S.hoverPanel) return;
    
    S.hoverPanel.innerHTML = '';
    
    // Add breadcrumb
    const breadcrumb = createBreadcrumb(data.path, data);
    S.hoverPanel.appendChild(breadcrumb);
    
    // Main info
    const mainInfo = document.createElement("div");
    mainInfo.innerHTML = `
      <b style="color: #4fc3f7;">${data.selector}</b><br>
      <span style="color: #999;">${data.width} × ${data.height}</span>
    `;
    S.hoverPanel.appendChild(mainInfo);
    
    // CSS Diff - only non-default values
    const cssDiff = document.createElement("div");
    cssDiff.style.cssText = `
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #444;
      font-size: 10px;
    `;
    
    const changedStyles = [];
    const cs = getComputedStyle(data.el);
    
    const propsToCheck = [
      { key: 'display', color: '#f9d71c' },
      { key: 'position', color: '#f9d71c' },
      { key: 'margin', color: '#f6b26b' },
      { key: 'padding', color: '#8bc3f5' },
      { key: 'fontSize', label: 'font-size', color: '#b5cea8' },
      { key: 'color', color: '#ce9178' },
      { key: 'background', label: 'background', color: '#ce9178' },
      { key: 'border', color: '#dcdcaa' },
      { key: 'borderRadius', label: 'border-radius', color: '#dcdcaa' },
      { key: 'fontWeight', label: 'font-weight', color: '#b5cea8' },
      { key: 'textAlign', label: 'text-align', color: '#9cdcfe' },
      { key: 'opacity', color: '#b5cea8' },
      { key: 'zIndex', label: 'z-index', color: '#b5cea8' }
    ];
    
    propsToCheck.forEach(({ key, label, color }) => {
      const value = data[key];
      if (isNonDefaultCSS(key, value)) {
        changedStyles.push(`<span style="color: #9cdcfe;">${label || key}:</span> <span style="color: ${color};">${value}</span>`);
      }
    });
    
    // Display type indicators
    const displayType = cs.display;
    if (displayType === 'flex' || displayType === 'inline-flex') {
      changedStyles.push(`<span style="color: #569cd6;">🔷 FLEX</span> ${data.flexDirection}`);
    } else if (displayType === 'grid' || displayType === 'inline-grid') {
      changedStyles.push(`<span style="color: #9333ea;">⊞ GRID</span>`);
    }
    
    if (changedStyles.length > 0) {
      cssDiff.innerHTML = `<div style="color: #4caf50; font-weight: bold; margin-bottom: 4px;">Changed styles:</div>` +
        changedStyles.join('<br>');
    } else {
      cssDiff.innerHTML = `<span style="color: #666;">All default values</span>`;
    }
    
    S.hoverPanel.appendChild(cssDiff);
    
    // Keyboard hints
    const hints = document.createElement("div");
    hints.style.cssText = `
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #444;
      font-size: 9px;
      color: #666;
    `;
    hints.innerHTML = `Press <kbd style="background: #444; padding: 2px 4px; border-radius: 2px;">C</kbd> to copy CSS`;
    S.hoverPanel.appendChild(hints);
  }

  function ensureHoverUI() {
    if (!S.hoverPanel) {
      S.hoverPanel = document.createElement("div");
      S.hoverPanel.className = "di-hover-panel";
      Object.assign(S.hoverPanel.style, {
        position: "fixed",
        top: "10px",
        left: "10px",
        background: "rgba(34, 34, 34, 0.95)",
        color: "#fff",
        fontSize: "11px",
        padding: "8px 10px",
        borderRadius: "6px",
        zIndex: 99999,
        pointerEvents: "none",
        boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
        maxWidth: "400px",
        fontFamily: "system-ui, -apple-system, monospace",
        backdropFilter: "blur(10px)",
        maxHeight: "80vh",
        overflowY: "auto"
      });
      document.body.appendChild(S.hoverPanel);
    }
  }

  function ensurePanelContainer() {
    if (!S.panelContainer) {
      S.panelContainer = document.createElement("div");
      S.panelContainer.className = "di-selected-panel";
      
      const startX = S.panelX !== null ? S.panelX : window.innerWidth - 330;
      const startY = S.panelY !== null ? S.panelY : 10;
      
      Object.assign(S.panelContainer.style, {
        position: "fixed",
        top: startY + "px",
        left: startX + "px",
        width: "320px",
        maxHeight: "80vh",
        background: "rgba(30, 30, 30, 0.95)",
        color: "#fff",
        fontSize: "12px",
        borderRadius: "6px",
        zIndex: 99999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backdropFilter: "blur(10px)"
      });
      
      const header = document.createElement("div");
      header.className = "di-panel-header";
      Object.assign(header.style, {
        padding: "10px",
        cursor: "move",
        background: "#2d2d2d",
        borderRadius: "6px 6px 0 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        userSelect: "none"
      });
      
      const title = document.createElement("span");
      title.textContent = "Selected Elements";
      title.style.fontWeight = "bold";
      
      const collapseBtn = document.createElement("button");
      collapseBtn.className = "di-collapse-btn";
      collapseBtn.textContent = "−";
      Object.assign(collapseBtn.style, {
        background: "none",
        border: "none",
        color: "#fff",
        fontSize: "18px",
        cursor: "pointer",
        padding: "0 6px",
        lineHeight: "1"
      });
      
      collapseBtn.onclick = (e) => {
        e.stopPropagation();
        togglePanelCollapse();
      };
      
      header.appendChild(title);
      header.appendChild(collapseBtn);
      
      const content = document.createElement("div");
      content.className = "di-panel-content";
      Object.assign(content.style, {
        maxHeight: "calc(80vh - 40px)",
        overflow: "auto",
        padding: "10px"
      });
      
      S.panelContainer.appendChild(header);
      S.panelContainer.appendChild(content);
      
      header.addEventListener("mousedown", startDrag);
      
      document.body.appendChild(S.panelContainer);
    }
  }

  function togglePanelCollapse() {
    S.panelCollapsed = !S.panelCollapsed;
    const content = S.panelContainer?.querySelector(".di-panel-content");
    const collapseBtn = S.panelContainer?.querySelector(".di-collapse-btn");
    
    if (content && collapseBtn) {
      if (S.panelCollapsed) {
        content.style.display = "none";
        collapseBtn.textContent = "+";
      } else {
        content.style.display = "block";
        collapseBtn.textContent = "−";
      }
    }
  }

  function startDrag(e) {
    if (!S.panelContainer) return;
    S.isDragging = true;
    const rect = S.panelContainer.getBoundingClientRect();
    S.dragOffsetX = e.clientX - rect.left;
    S.dragOffsetY = e.clientY - rect.top;
    
    S.handlers.drag = drag;
    S.handlers.stopDrag = stopDrag;
    document.addEventListener("mousemove", S.handlers.drag);
    document.addEventListener("mouseup", S.handlers.stopDrag);
  }

  function drag(e) {
    if (!S.isDragging || !S.panelContainer) return;
    
    const x = e.clientX - S.dragOffsetX;
    const y = e.clientY - S.dragOffsetY;
    
    S.panelX = Math.max(0, Math.min(x, window.innerWidth - S.panelContainer.offsetWidth));
    S.panelY = Math.max(0, Math.min(y, window.innerHeight - 50));
    
    S.panelContainer.style.left = S.panelX + "px";
    S.panelContainer.style.top = S.panelY + "px";
  }

  function stopDrag() {
    S.isDragging = false;
    if (S.handlers.drag) document.removeEventListener("mousemove", S.handlers.drag);
    if (S.handlers.stopDrag) document.removeEventListener("mouseup", S.handlers.stopDrag);
  }

  /* ---------------- INSPECT FLOW ---------------- */
  function startInspect() {
    if (!isValidState() || S.state === STATES.INSPECTING) return;
    
    setState(STATES.INSPECTING);
    S.inspecting = true;
    document.body.style.cursor = "crosshair";
    ensureInspectButton();
    ensureHoverUI();
    
    if (S.inspectBtn) {
      S.inspectBtn.textContent = "Inspecting... (Esc to exit)";
      S.inspectBtn.style.background = "#ff6600";
      S.inspectBtn.style.transform = "none";
    }
    
    attachEventListeners();
  }

  function stopInspect() {
    if (!isValidState()) return;
    
    setState(S.selectedItems.length > 0 ? STATES.SELECTED : STATES.IDLE);
    S.inspecting = false;
    document.body.style.cursor = "default";
    
    if (S.inspectBtn) {
      S.inspectBtn.textContent = "Inspect";
      S.inspectBtn.style.background = "#007acc";
    }
    
    if (S.rafId) {
      cancelAnimationFrame(S.rafId);
      S.rafId = null;
    }
    
    hideBoxModelLayers();
  }

  /* ---------------- EVENT HANDLERS WITH RAF ---------------- */
  function attachEventListeners() {
    detachEventListeners();
    
    S.handlers.mousemove = handleMouseMove;
    S.handlers.click = handleClick;
    S.handlers.keydown = handleKeyDown;
    S.handlers.scroll = handleScroll;
    
    document.addEventListener("mousemove", S.handlers.mousemove);
    document.addEventListener("click", S.handlers.click, true);
    document.addEventListener("keydown", S.handlers.keydown);
    document.addEventListener("scroll", S.handlers.scroll, true);
  }

  function detachEventListeners() {
    if (S.handlers.mousemove) document.removeEventListener("mousemove", S.handlers.mousemove);
    if (S.handlers.click) document.removeEventListener("click", S.handlers.click, true);
    if (S.handlers.keydown) document.removeEventListener("keydown", S.handlers.keydown);
    if (S.handlers.scroll) document.removeEventListener("scroll", S.handlers.scroll, true);
  }

  function processMouseMove() {
    if (!S.pendingMouseEvent || !isValidState() || !S.inspecting) {
      S.rafId = null;
      return;
    }
    
    const e = S.pendingMouseEvent;
    S.pendingMouseEvent = null;
    
    if (isInspectorElement(e.target)) {
      hideBoxModelLayers();
      if (S.hoverPanel) S.hoverPanel.style.display = "none";
      S.rafId = null;
      return;
    }
    
    if (e.target === S.lastHoveredElement) {
      S.rafId = null;
      return;
    }
    
    S.lastHoveredElement = e.target;
    const d = getData(e.target);
    updateBoxModelLayers(d);
    
    if (S.hoverPanel) {
      S.hoverPanel.style.display = "block";
      updateHoverPanel(d);
    }
    
    S.rafId = null;
  }

  function handleMouseMove(e) {
    if (!isValidState() || !S.inspecting) return;
    
    S.pendingMouseEvent = e;
    
    if (!S.rafId) {
      S.rafId = requestAnimationFrame(processMouseMove);
    }
  }

  function handleClick(e) {
    if (!isValidState() || !S.inspecting) return;
    
    if (isInspectorElement(e.target)) return;
    
    e.preventDefault();
    e.stopPropagation();
    addSelected(getData(e.target));
    stopInspect();
  }

  function handleKeyDown(e) {
    if (!isValidState() || !S.inspecting) return;
    
    if (e.key === "Escape") {
      e.preventDefault();
      stopInspect();
    } else if (e.key === "c" || e.key === "C") {
      if (S.lastHoveredElement && !isInspectorElement(S.lastHoveredElement)) {
        e.preventDefault();
        const data = getData(S.lastHoveredElement);
        navigator.clipboard.writeText(cssText(data));
        
        if (S.hoverPanel) {
          const notification = document.createElement("div");
          notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(76, 175, 80, 0.95);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            z-index: 100001;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          `;
          notification.textContent = '✓ CSS Copied to Clipboard!';
          document.body.appendChild(notification);
          
          setTimeout(() => remove(notification), 1500);
        }
      }
    }
  }

  let scrollTimeout;
  function handleScroll() {
    if (!isValidState() || !S.inspecting) return;
    
    hideBoxModelLayers();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (S.inspecting && isValidState() && S.lastHoveredElement) {
        if (!isInspectorElement(S.lastHoveredElement)) {
          updateBoxModelLayers(getData(S.lastHoveredElement));
        }
      }
    }, 50);
  }

  /* ---------------- PSEUDO-STATE INSPECTOR ---------------- */
  function createPseudoStateToggle(data) {
    const container = document.createElement("div");
    container.style.cssText = `
      background: #2d2d2d;
      padding: 8px;
      margin: 8px 0;
      border-radius: 4px;
    `;
    
    const title = document.createElement("div");
    title.textContent = "Pseudo States:";
    title.style.cssText = "font-size: 10px; color: #999; margin-bottom: 6px;";
    container.appendChild(title);
    
    const states = ['hover', 'focus', 'active'];
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = "display: flex; gap: 6px;";
    
    states.forEach(state => {
      const btn = document.createElement("button");
      btn.textContent = `:${state}`;
      btn.className = `di-pseudo-btn di-pseudo-${state}`;
      Object.assign(btn.style, {
        padding: "4px 8px",
        border: "1px solid #555",
        background: "#3a3a3a",
        color: "#fff",
        borderRadius: "3px",
        cursor: "pointer",
        fontSize: "10px",
        fontFamily: "monospace",
        transition: "all 0.2s"
      });
      
      let isActive = false;
      
      btn.onclick = (e) => {
        e.stopPropagation();
        isActive = !isActive;
        
        if (isActive) {
          btn.style.background = "#007acc";
          btn.style.borderColor = "#007acc";
          data.el.classList.add(`di-force-${state}`);
          
          // Apply pseudo-state styles
          const styleId = `di-pseudo-style-${state}`;
          let style = document.getElementById(styleId);
          if (!style) {
            style = document.createElement("style");
            style.id = styleId;
            document.head.appendChild(style);
          }
          style.textContent = `.di-force-${state} { /* Forced ${state} state */ }`;
          
          if (state === 'hover') {
            data.el.style.setProperty('pointer-events', 'auto', 'important');
          }
        } else {
          btn.style.background = "#3a3a3a";
          btn.style.borderColor = "#555";
          data.el.classList.remove(`di-force-${state}`);
        }
      };
      
      buttonContainer.appendChild(btn);
    });
    
    container.appendChild(buttonContainer);
    return container;
  }

  /* ---------------- SELECTED ITEMS ---------------- */
  function addSelected(data) {
    if (!isValidState() || !Array.isArray(S.selectedItems)) {
      S.selectedItems = [];
    }
    
    ensurePanelContainer();

    const overlay = document.createElement("div");
    overlay.className = "di-selected-overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      top: (data.rect.top + window.scrollY) + "px",
      left: (data.rect.left + window.scrollX) + "px",
      width: data.rect.width + "px",
      height: data.rect.height + "px",
      border: "2px solid #00ff00",
      background: "rgba(0,255,0,.1)",
      zIndex: 99994,
      pointerEvents: "none",
      boxSizing: "border-box"
    });
    document.body.appendChild(overlay);

    const item = document.createElement("div");
    item.className = "di-panel-item";
    item.style.borderBottom = "1px solid #444";
    item.style.marginBottom = "8px";
    item.style.paddingBottom = "8px";
    
    // Breadcrumb
    const breadcrumb = createBreadcrumb(data.path, data);
    item.appendChild(breadcrumb);
    
    const header = document.createElement("div");
    header.innerHTML = `<b>${data.selector}</b><div style="color: #999; margin-top: 2px;">${data.width} × ${data.height}</div>`;
    
    // Pseudo-state controls
    const pseudoControls = createPseudoStateToggle(data);
    
    const cssPreview = document.createElement("pre");
    cssPreview.className = "di-css-preview";
    cssPreview.style.cssText = `
      background: #2d2d2d;
      padding: 8px;
      margin: 8px 0;
      border-radius: 4px;
      font-size: 10px;
      overflow-x: auto;
      max-height: 200px;
      overflow-y: auto;
      font-family: 'Courier New', monospace;
      line-height: 1.4;
    `;
    cssPreview.textContent = cssText(data);

    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.gap = "6px";
    
    const copyBtn = document.createElement("button");
    copyBtn.className = "di-button di-copy-btn";
    copyBtn.textContent = "Copy CSS";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(cssText(data));
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => copyBtn.textContent = "Copy CSS", 1500);
    };

    const clearBtn = document.createElement("button");
    clearBtn.className = "di-button di-clear-btn";
    clearBtn.textContent = "Remove";

    [copyBtn, clearBtn].forEach(b => Object.assign(b.style, {
      marginTop: "6px",
      padding: "6px 10px",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "11px",
      fontWeight: "500",
      transition: "all 0.2s"
    }));

    copyBtn.style.background = "#007acc";
    copyBtn.style.color = "#fff";
    clearBtn.style.background = "#cc0000";
    clearBtn.style.color = "#fff";
    
    copyBtn.onmouseenter = () => copyBtn.style.background = "#005a9e";
    copyBtn.onmouseleave = () => copyBtn.style.background = "#007acc";
    clearBtn.onmouseenter = () => clearBtn.style.background = "#990000";
    clearBtn.onmouseleave = () => clearBtn.style.background = "#cc0000";

    clearBtn.onclick = () => {
      remove(overlay);
      remove(item);
      
      // Clean up forced pseudo-states
      data.el.classList.remove('di-force-hover', 'di-force-focus', 'di-force-active');
      
      if (Array.isArray(S.selectedItems)) {
        S.selectedItems = S.selectedItems.filter(i => i.item !== item);

        if (S.selectedItems.length === 0) {
          remove(S.panelContainer);
          remove(S.hoverPanel);
          S.panelContainer = null;
          S.hoverPanel = null;
          setState(STATES.IDLE);
        }
      }
    };

    btnContainer.appendChild(copyBtn);
    btnContainer.appendChild(clearBtn);
    item.append(header, pseudoControls, cssPreview, btnContainer);
    
    const content = S.panelContainer?.querySelector(".di-panel-content");
    if (content) {
      content.appendChild(item);
    }

    S.selectedItems.push({ overlay, item, data });
  }

  /* ---------------- CLEANUP ---------------- */
  function cleanup() {
    console.log('[DOM Inspector] Cleaning up...');
    setState(STATES.CLEANING);
    
    detachEventListeners();
    stopDrag();
    
    if (S.rafId) {
      cancelAnimationFrame(S.rafId);
      S.rafId = null;
    }
    
    remove(S.hoverPanel);
    remove(S.panelContainer);
    remove(S.inspectBtn);
    Object.values(S.boxModelLayers).forEach(layer => remove(layer));
    clearGridFlexOverlays();
    
    if (Array.isArray(S.selectedItems)) {
      S.selectedItems.forEach(i => {
        remove(i.overlay);
        if (i.data && i.data.el) {
          i.data.el.classList.remove('di-force-hover', 'di-force-focus', 'di-force-active');
        }
      });
    }
    
    // Clean up pseudo-state styles
    ['hover', 'focus', 'active'].forEach(state => {
      const style = document.getElementById(`di-pseudo-style-${state}`);
      if (style) remove(style);
    });
    
    S.hoverPanel = null;
    S.panelContainer = null;
    S.inspectBtn = null;
    S.boxModelLayers = {};
    S.gridFlexOverlays = [];
    S.selectedItems = [];
    S.lastHoveredElement = null;
    S.pendingMouseEvent = null;
    
    document.body.style.cursor = "default";
    window.__DOM_INSPECTOR__ = false;
    
    console.log('[DOM Inspector] Cleanup complete');
  }

  /* ---------------- MESSAGES ---------------- */
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "START_INSPECT") {
        startInspect();
      } else if (msg.type === "CLEAR_OVERLAY") {
        cleanup();
      }
    });
  }

  // Initialize
  setState(STATES.IDLE);
  ensureInspectButton();
  
  console.log('[DOM Inspector] Enhanced version initialized with:');
  console.log('  ✓ Element path breadcrumb (clickable)');
  console.log('  ✓ Live CSS diff (non-default styles only)');
  console.log('  ✓ Pseudo-state inspector (:hover, :focus, :active)');
  console.log('  ✓ Grid/Flex visual helpers');
  console.log('  ✓ Performance-safe RAF throttling');
})();