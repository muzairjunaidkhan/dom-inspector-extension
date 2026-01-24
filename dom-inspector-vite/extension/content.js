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
    scrollTimeout: null,
    resizeObserver: null,
    currentViewport: { width: window.innerWidth, height: window.innerHeight, name: 'Current' },
    responsiveMode: false,
    responsivePanel: null,
    viewportFrame: null,
    iframeHandlers: null,
    originalViewportMeta: undefined,
    handlers: {
      mousemove: null,
      click: null,
      keydown: null,
      scroll: null,
      drag: null,
      stopDrag: null
    }
  };
  // Cache for element data to reduce recalculations
  const elementDataCache = new Map();
  let cacheInvalidationFrame = null;
  // Responsive viewport presets
  const viewportPresets = [
    { name: 'iPhone SE', width: 375, height: 667, type: 'mobile' },
    { name: 'iPhone 12/13', width: 390, height: 844, type: 'mobile' },
    { name: 'iPhone 14 Pro Max', width: 430, height: 932, type: 'mobile' },
    { name: 'Samsung Galaxy S21', width: 360, height: 800, type: 'mobile' },
    { name: 'iPad Mini', width: 768, height: 1024, type: 'tablet' },
    { name: 'iPad Air', width: 820, height: 1180, type: 'tablet' },
    { name: 'iPad Pro 12.9"', width: 1024, height: 1366, type: 'tablet' },
    { name: 'Desktop Small', width: 1366, height: 768, type: 'desktop' },
    { name: 'Desktop Medium', width: 1920, height: 1080, type: 'desktop' },
    { name: 'Desktop Large', width: 2560, height: 1440, type: 'desktop' },
    { name: 'Custom', width: 0, height: 0, type: 'custom' }
  ];
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

  /*  UTILS  */
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
    // Check cache first
    const cached = elementDataCache.get(el);
    if (cached && cached.data) return cached.data;

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

    const data = {
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

    // Cache the data with timestamp for cleanup
    elementDataCache.set(el, { data, timestamp: Date.now() });

    // Schedule cache invalidation on next frame
    if (!cacheInvalidationFrame) {
      cacheInvalidationFrame = requestAnimationFrame(() => {
        // Clear cache to prevent memory leaks
        elementDataCache.clear();
        cacheInvalidationFrame = null;
      });
    }

    return data;
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

  /*  GRID/FLEX VISUALIZATION  */
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

  /*  BOX MODEL VISUALIZATION  */
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

    // Margin layer (Warm Orange - suggests "space outside")
    const marginLayer = document.createElement("div");
    marginLayer.className = "di-box-layer di-box-margin";
    Object.assign(marginLayer.style, {
      position: "absolute",
      top: (r.top + window.scrollY - margin[0]) + "px",
      left: (r.left + window.scrollX - margin[3]) + "px",
      width: (r.width + margin[1] + margin[3]) + "px",
      height: (r.height + margin[0] + margin[2]) + "px",
      background: "rgba(255, 152, 0, 0.25)", // Warm orange - external spacing
      border: "1px dashed rgba(255, 152, 0, 0.8)",
      boxShadow: "inset 0 0 0 1px rgba(255, 152, 0, 0.15)",
      zIndex: 99995,
      pointerEvents: "none",
      boxSizing: "border-box"
    });
    document.body.appendChild(marginLayer);
    S.boxModelLayers.margin = marginLayer;

    // Border layer (Golden Yellow - suggests "boundary/frame")
    const borderLayer = document.createElement("div");
    borderLayer.className = "di-box-layer di-box-border";
    Object.assign(borderLayer.style, {
      position: "absolute",
      top: (r.top + window.scrollY) + "px",
      left: (r.left + window.scrollX) + "px",
      width: r.width + "px",
      height: r.height + "px",
      background: "rgba(255, 235, 59, 0.25)", // Golden yellow - protective boundary
      border: "1px solid rgba(255, 235, 59, 0.9)",
      boxShadow: "inset 0 0 0 1px rgba(255, 235, 59, 0.2)",
      zIndex: 99996,
      pointerEvents: "none",
      boxSizing: "border-box"
    });
    document.body.appendChild(borderLayer);
    S.boxModelLayers.border = borderLayer;

    // Padding layer (Soft Green - suggests "internal breathing room")
    const paddingWidth = r.width - border[1] - border[3];
    const paddingHeight = r.height - border[0] - border[2];

    if (paddingWidth > 0 && paddingHeight > 0) {
      const paddingLayer = document.createElement("div");
      paddingLayer.className = "di-box-layer di-box-padding";
      Object.assign(paddingLayer.style, {
        position: "absolute",
        top: (r.top + window.scrollY + border[0]) + "px",
        left: (r.left + window.scrollX + border[3]) + "px",
        width: paddingWidth + "px",
        height: paddingHeight + "px",
        background: "rgba(139, 195, 74, 0.25)", // Soft green - comfortable internal space
        border: "1px dotted rgba(139, 195, 74, 0.8)",
        boxShadow: "inset 0 0 0 1px rgba(139, 195, 74, 0.15)",
        zIndex: 99997,
        pointerEvents: "none",
        boxSizing: "border-box"
      });
      document.body.appendChild(paddingLayer);
      S.boxModelLayers.padding = paddingLayer;
    }

    // Content layer (Cool Blue - suggests "core/content area")
    const contentWidth = r.width - border[1] - border[3] - padding[1] - padding[3];
    const contentHeight = r.height - border[0] - border[2] - padding[0] - padding[2];

    if (contentWidth > 0 && contentHeight > 0) {
      const contentLayer = document.createElement("div");
      contentLayer.className = "di-box-layer di-box-content";
      Object.assign(contentLayer.style, {
        position: "absolute",
        top: (r.top + window.scrollY + border[0] + padding[0]) + "px",
        left: (r.left + window.scrollX + border[3] + padding[3]) + "px",
        width: contentWidth + "px",
        height: contentHeight + "px",
        background: "rgba(33, 150, 243, 0.30)", // Cool blue - trustworthy content area
        border: "2px solid rgba(33, 150, 243, 0.95)",
        boxShadow: "inset 0 0 0 1px rgba(33, 150, 243, 0.2), 0 0 8px rgba(33, 150, 243, 0.3)",
        zIndex: 99998,
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

  /*  UI CREATION  */
  function ensureInspectButton() {
    if (S.inspectBtn) return;

    // Existing inspect button code...
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

    // ADD RESPONSIVE MODE BUTTON
    const responsiveBtn = document.createElement("button");
    responsiveBtn.id = "dom-responsive-btn";
    responsiveBtn.className = "di-responsive-btn";
    responsiveBtn.textContent = "📱 Responsive";
    Object.assign(responsiveBtn.style, {
      position: "fixed",
      bottom: "20px",
      right: "110px", // Position to the left of inspect button
      zIndex: 100000,
      padding: "10px 14px",
      background: "#6f42c1",
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

    responsiveBtn.onmouseenter = () => {
      responsiveBtn.style.background = "#5a32a3";
      responsiveBtn.style.transform = "translateY(-1px)";
      responsiveBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
    };

    responsiveBtn.onmouseleave = () => {
      responsiveBtn.style.background = "#6f42c1";
      responsiveBtn.style.transform = "translateY(0)";
      responsiveBtn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    };

    responsiveBtn.onclick = (e) => {
      e.stopPropagation();
      if (!S.responsiveMode) {
        enterResponsiveMode();
        responsiveBtn.textContent = "❌ Exit Responsive";
        responsiveBtn.style.background = "#dc3545";
      } else {
        exitResponsiveMode();
        responsiveBtn.textContent = "📱 Responsive";
        responsiveBtn.style.background = "#6f42c1";
      }
    };

    document.body.appendChild(responsiveBtn);
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
        position: "absolute",  // Changed from "fixed"
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
        maxHeight: "300px",  // Changed from "80vh" for better control
        overflowY: "auto",
        // No initial top/left - will be set dynamically
        willChange: "transform"  // Performance hint for repositioning
      });
      document.body.appendChild(S.hoverPanel);
    }
  }
  function positionHoverPanel(data) {
    if (!S.hoverPanel) return;

    const r = data.rect;
    const panelRect = S.hoverPanel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    const OFFSET = 10; // Gap between element and panel
    const VIEWPORT_PADDING = 10; // Keep panel away from viewport edges

    let top, left;

    // Try positioning above the element
    if (r.top - panelRect.height - OFFSET > VIEWPORT_PADDING) {
      top = r.top + scrollY - panelRect.height - OFFSET;
      left = r.left + scrollX;
    }
    // Try positioning below the element
    else if (r.bottom + panelRect.height + OFFSET < viewportHeight - VIEWPORT_PADDING) {
      top = r.bottom + scrollY + OFFSET;
      left = r.left + scrollX;
    }
    // Try positioning to the right
    else if (r.right + panelRect.width + OFFSET < viewportWidth - VIEWPORT_PADDING) {
      top = r.top + scrollY;
      left = r.right + scrollX + OFFSET;
    }
    // Try positioning to the left
    else if (r.left - panelRect.width - OFFSET > VIEWPORT_PADDING) {
      top = r.top + scrollY;
      left = r.left + scrollX - panelRect.width - OFFSET;
    }
    // Fallback: top-left of viewport with fixed positioning
    else {
      S.hoverPanel.style.position = "fixed";
      S.hoverPanel.style.top = VIEWPORT_PADDING + "px";
      S.hoverPanel.style.left = VIEWPORT_PADDING + "px";
      return;
    }

    // Ensure position is absolute and constrain to viewport
    S.hoverPanel.style.position = "absolute";

    // Constrain horizontal position
    left = Math.max(
      scrollX + VIEWPORT_PADDING,
      Math.min(left, scrollX + viewportWidth - panelRect.width - VIEWPORT_PADDING)
    );

    // Constrain vertical position
    top = Math.max(
      scrollY + VIEWPORT_PADDING,
      Math.min(top, scrollY + viewportHeight - panelRect.height - VIEWPORT_PADDING)
    );

    S.hoverPanel.style.top = top + "px";
    S.hoverPanel.style.left = left + "px";
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

  /*  INSPECT FLOW  */
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
    initializeResizeObserver();
    // attachEventListeners();

    // NEW: Enable iframe inspector if in responsive mode
    if (S.responsiveMode && S.viewportFrame?.iframe) {
      enableIframeInspector();
    } else {
      attachEventListeners();
    }
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
    // Hide hover panel when stopping inspection
    if (S.hoverPanel) {
      S.hoverPanel.style.display = "none";
    }
    // Clear last hovered element reference
    S.lastHoveredElement = null;
  }

  /*  EVENT HANDLERS WITH RAF  */
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
      positionHoverPanel(d);
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

  function handleScroll() {
    if (!isValidState() || !S.inspecting) return;

    hideBoxModelLayers();

    // Clear previous timeout to prevent memory leak
    if (S.scrollTimeout) {
      clearTimeout(S.scrollTimeout);
      S.scrollTimeout = null;
    }

    S.scrollTimeout = setTimeout(() => {
      if (S.inspecting && isValidState() && S.lastHoveredElement) {
        if (!isInspectorElement(S.lastHoveredElement)) {
          const d = getData(S.lastHoveredElement);
          updateBoxModelLayers(d);
          positionHoverPanel(d);
        }
      }
      S.scrollTimeout = null;  // Clean reference after execution
    }, 50);
  }
  function initializeResizeObserver() {
    if (S.resizeObserver) return;

    S.resizeObserver = new ResizeObserver(() => {
      // Invalidate cache when window resizes
      elementDataCache.clear();

      // Update box model layers if inspecting
      if (S.inspecting && S.lastHoveredElement && !isInspectorElement(S.lastHoveredElement)) {
        const d = getData(S.lastHoveredElement);
        updateBoxModelLayers(d);
        positionHoverPanel(d);
      }
    });

    S.resizeObserver.observe(document.body);
  }



  // NEW RESPONSIVE DESIGN TESTING
  function createViewportFrame() {
    if (S.viewportFrame) return;

    // Background overlay
    const overlay = document.createElement("div");
    overlay.className = "di-viewport-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "#1e1e1e",
      zIndex: 99990,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    });

    // Device frame container
    const frameContainer = document.createElement("div");
    frameContainer.className = "di-frame-container";
    Object.assign(frameContainer.style, {
      position: "relative",
      background: "#000",
      borderRadius: "12px",
      padding: "60px 20px 60px 20px", // Space for device chrome
      boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    });

    // Iframe for content isolation
    const iframe = document.createElement("iframe");
    iframe.className = "di-viewport-iframe";
    Object.assign(iframe.style, {
      border: "none",
      background: "#fff",
      display: "block",
      borderRadius: "4px"
    });

    frameContainer.appendChild(iframe);
    overlay.appendChild(frameContainer);

    // Toolbar with controls
    const toolbar = document.createElement("div");
    toolbar.className = "di-viewport-toolbar";
    Object.assign(toolbar.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(30, 30, 30, 0.95)",
      borderRadius: "8px",
      padding: "12px 20px",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "12px",
      color: "#fff",
      backdropFilter: "blur(10px)",
      zIndex: 99992,
      boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
      userSelect: "none"
    });

    // Dimensions display
    const dimensionsLabel = document.createElement("div");
    dimensionsLabel.id = "di-frame-dimensions";
    dimensionsLabel.style.cssText = "font-weight: 600; color: #4fc3f7; font-family: monospace;";

    // Zoom controls
    const zoomContainer = document.createElement("div");
    zoomContainer.style.cssText = "display: flex; align-items: center; gap: 8px;";

    const zoomLabel = document.createElement("span");
    zoomLabel.style.color = "#999";
    zoomLabel.textContent = "Zoom:";

    const zoomValue = document.createElement("span");
    zoomValue.id = "di-zoom-value";
    zoomValue.style.cssText = "color: #4fc3f7; min-width: 45px; text-align: center; font-family: monospace;";
    zoomValue.textContent = "100%";

    const zoomOut = createToolbarButton("−", () => adjustZoom(-0.1));
    const zoomIn = createToolbarButton("+", () => adjustZoom(0.1));
    const zoomReset = createToolbarButton("Reset", () => setZoom(1));

    zoomContainer.append(zoomLabel, zoomOut, zoomValue, zoomIn, zoomReset);

    // Rotate button
    const rotateBtn = createToolbarButton("⟲ Rotate", () => rotateViewport());

    // Touch mode toggle
    const touchToggle = document.createElement("label");
    touchToggle.style.cssText = "display: flex; align-items: center; gap: 6px; cursor: pointer;";

    const touchCheckbox = document.createElement("input");
    touchCheckbox.type = "checkbox";
    touchCheckbox.id = "di-touch-mode";
    touchCheckbox.checked = true;
    touchCheckbox.style.cursor = "pointer";

    const touchLabel = document.createElement("span");
    touchLabel.textContent = "Touch Mode";
    touchLabel.style.color = "#999";

    touchToggle.append(touchCheckbox, touchLabel);

    toolbar.append(dimensionsLabel, zoomContainer, rotateBtn, touchToggle);

    document.body.appendChild(overlay);
    document.body.appendChild(toolbar);

    S.viewportFrame = {
      overlay: overlay,
      frameContainer: frameContainer,
      iframe: iframe,
      toolbar: toolbar,
      zoomLevel: 1
    };

    // Clone current page into iframe
    iframe.onload = () => {
      initializeIframeContent();
    };

    // Trigger initial load
    iframe.srcdoc = "<!DOCTYPE html><html><head></head><body></body></html>";
  }
  // Helper to create toolbar buttons
  function createToolbarButton(text, onClick) {
    const btn = document.createElement("button");
    btn.textContent = text;
    Object.assign(btn.style, {
      padding: "6px 12px",
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "4px",
      color: "#fff",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: "500",
      transition: "all 0.2s",
      whiteSpace: "nowrap"
    });

    btn.onmouseenter = () => {
      btn.style.background = "rgba(255,255,255,0.2)";
      btn.style.borderColor = "#007acc";
    };
    btn.onmouseleave = () => {
      btn.style.background = "rgba(255,255,255,0.1)";
      btn.style.borderColor = "rgba(255,255,255,0.2)";
    };

    btn.onclick = onClick;
    return btn;
  }
  // Initialize iframe with current page content
  function initializeIframeContent() {
    const iframe = S.viewportFrame?.iframe;
    if (!iframe || !iframe.contentDocument) return;

    const iframeDoc = iframe.contentDocument;

    // Clone head content (styles, meta tags, etc.)
    const headContent = document.head.cloneNode(true);

    // Remove existing viewport meta and add responsive one
    const existingViewport = headContent.querySelector('meta[name="viewport"]');
    if (existingViewport) existingViewport.remove();

    const viewportMeta = iframeDoc.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = `width=${S.currentViewport.width}, initial-scale=1.0, user-scalable=no`;
    headContent.appendChild(viewportMeta);

    // Clone body content
    const bodyContent = document.body.cloneNode(true);

    // Remove inspector UI elements from clone
    const inspectorElements = bodyContent.querySelectorAll('.di-inspect-btn, .di-responsive-btn, .di-viewport-overlay, .di-viewport-toolbar, .di-responsive-panel, .di-hover-panel, .di-selected-panel, .di-selected-overlay, .di-box-layer, .di-grid-overlay, .di-flex-overlay');
    inspectorElements.forEach(el => el.remove());

    // Replace iframe content
    iframeDoc.documentElement.innerHTML = '';
    iframeDoc.documentElement.appendChild(headContent);
    iframeDoc.documentElement.appendChild(bodyContent);

    // Apply viewport dimensions
    applyViewportToIframe(S.currentViewport);

    // Enable inspector in iframe if it was active
    if (S.inspecting) {
      enableIframeInspector();
    }
  }
  // Zoom controls
  function adjustZoom(delta) {
    const newZoom = Math.max(0.25, Math.min(2, S.viewportFrame.zoomLevel + delta));
    setZoom(newZoom);
  }
  function setZoom(zoom) {
    if (!S.viewportFrame) return;

    S.viewportFrame.zoomLevel = zoom;
    const iframe = S.viewportFrame.iframe;
    const frameContainer = S.viewportFrame.frameContainer;

    frameContainer.style.transform = `scale(${zoom})`;
    frameContainer.style.transformOrigin = "center center";

    const zoomValue = document.getElementById("di-zoom-value");
    if (zoomValue) {
      zoomValue.textContent = Math.round(zoom * 100) + "%";
    }
  }
  function rotateViewport() {
    const temp = S.currentViewport.width;
    applyViewport({
      ...S.currentViewport,
      width: S.currentViewport.height,
      height: temp
    });
  }
  function applyViewport(preset) {
    if (!S.responsiveMode) return;

    S.currentViewport = { ...preset };

    applyViewportToIframe(preset);

    // Update UI displays
    updateViewportDisplays(preset);
  }
  function applyViewportToIframe(preset) {
    const iframe = S.viewportFrame?.iframe;
    const frameContainer = S.viewportFrame?.frameContainer;
    if (!iframe || !frameContainer) return;

    // Set iframe dimensions
    iframe.style.width = preset.width + "px";
    iframe.style.height = preset.height + "px";

    // Update viewport meta in iframe
    const iframeDoc = iframe.contentDocument;
    if (iframeDoc) {
      let viewportMeta = iframeDoc.querySelector('meta[name="viewport"]');
      if (!viewportMeta) {
        viewportMeta = iframeDoc.createElement('meta');
        viewportMeta.name = 'viewport';
        iframeDoc.head.appendChild(viewportMeta);
      }
      viewportMeta.content = `width=${preset.width}, initial-scale=1.0, user-scalable=no`;

      // Force layout recalculation
      iframeDoc.body.offsetHeight;

      // Dispatch resize event in iframe
      iframe.contentWindow.dispatchEvent(new Event('resize'));
    }

    // Auto-fit zoom if needed
    autoFitZoom(preset);
  }
  function autoFitZoom(preset) {
    const maxWidth = window.innerWidth - 400; // Leave space for panels
    const maxHeight = window.innerHeight - 200; // Leave space for toolbar

    let scale = 1;
    if (preset.width > maxWidth || preset.height > maxHeight) {
      const scaleX = maxWidth / preset.width;
      const scaleY = maxHeight / preset.height;
      scale = Math.min(scaleX, scaleY, 1);
    }

    setZoom(scale);
  }
  function updateViewportDisplays(preset) {
    const widthDisplay = document.getElementById("di-viewport-width");
    const heightDisplay = document.getElementById("di-viewport-height");
    const nameDisplay = document.getElementById("di-viewport-name");
    const dimensionsLabel = document.getElementById("di-frame-dimensions");

    if (widthDisplay) widthDisplay.textContent = preset.width;
    if (heightDisplay) heightDisplay.textContent = preset.height;
    if (nameDisplay) nameDisplay.textContent = preset.name;
    if (dimensionsLabel) dimensionsLabel.textContent = `${preset.width} × ${preset.height}`;

    // Update custom inputs in responsive panel
    const widthInput = document.getElementById("di-custom-width");
    const heightInput = document.getElementById("di-custom-height");
    if (widthInput) widthInput.value = preset.width;
    if (heightInput) heightInput.value = preset.height;
  }

  // Enable inspector to work inside iframe
  function enableIframeInspector() {
    const iframe = S.viewportFrame?.iframe;
    if (!iframe || !iframe.contentDocument) return;

    const iframeDoc = iframe.contentDocument;
    const iframeWin = iframe.contentWindow;

    // Attach event listeners to iframe document
    const iframeMouseMove = (e) => {
      if (!S.inspecting) return;

      const target = e.target;
      if (isInspectorElement(target)) return;

      // Map iframe coordinates to parent
      const iframeRect = iframe.getBoundingClientRect();
      const zoom = S.viewportFrame.zoomLevel;

      const mappedEvent = {
        target: target,
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY
      };

      handleIframeMouseMove(mappedEvent);
    };

    const iframeClick = (e) => {
      if (!S.inspecting) return;

      const target = e.target;
      if (isInspectorElement(target)) return;

      e.preventDefault();
      e.stopPropagation();

      handleIframeClick(target);
    };

    const iframeKeyDown = (e) => {
      if (!S.inspecting) return;

      if (e.key === "Escape") {
        e.preventDefault();
        stopInspect();
      } else if (e.key === "c" || e.key === "C") {
        if (S.lastHoveredIframeElement) {
          e.preventDefault();
          const data = getDataFromIframeElement(S.lastHoveredIframeElement);
          navigator.clipboard.writeText(cssText(data));
          showCopyNotification();
        }
      }
    };

    iframeDoc.addEventListener("mousemove", iframeMouseMove);
    iframeDoc.addEventListener("click", iframeClick, true);
    iframeDoc.addEventListener("keydown", iframeKeyDown);

    // Touch event simulation
    const touchCheckbox = document.getElementById("di-touch-mode");
    if (touchCheckbox && touchCheckbox.checked) {
      enableTouchSimulation(iframeDoc);
    }

    // Store handlers for cleanup
    S.iframeHandlers = {
      mousemove: iframeMouseMove,
      click: iframeClick,
      keydown: iframeKeyDown
    };

    // Set cursor in iframe
    iframeDoc.body.style.cursor = "crosshair";
  }
  function handleIframeMouseMove(e) {
    if (!S.viewportFrame?.iframe) return;

    S.lastHoveredIframeElement = e.target;

    const data = getDataFromIframeElement(e.target);

    // Create overlay in parent document (positioned over iframe)
    updateIframeBoxModelLayers(data);

    if (S.hoverPanel) {
      S.hoverPanel.style.display = "block";
      updateHoverPanel(data);
      positionHoverPanelForIframe(data);
    }
  }
  function handleIframeClick(target) {
    const data = getDataFromIframeElement(target);
    addSelected(data);
    stopInspect();
  }
  function getDataFromIframeElement(el) {
    const iframe = S.viewportFrame?.iframe;
    if (!iframe) return null;

    const iframeDoc = iframe.contentDocument;
    const cs = iframeDoc.defaultView.getComputedStyle(el);
    const r = el.getBoundingClientRect();

    // Map coordinates from iframe to parent
    const iframeRect = iframe.getBoundingClientRect();
    const zoom = S.viewportFrame.zoomLevel;

    const mappedRect = {
      top: iframeRect.top + (r.top * zoom),
      left: iframeRect.left + (r.left * zoom),
      width: r.width * zoom,
      height: r.height * zoom,
      bottom: iframeRect.top + (r.bottom * zoom),
      right: iframeRect.left + (r.right * zoom)
    };

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

    return {
      el,
      rect: mappedRect,
      selector,
      path: getElementPath(el),
      fontSize: cs.fontSize,
      color: cs.color,
      background: cs.backgroundColor,
      margin: cs.margin,
      marginValues: parseBox(cs.margin),
      padding: cs.padding,
      paddingValues: parseBox(cs.padding),
      borderValues: parseBox(cs.borderWidth),
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
      transform: cs.transform,
      isIframeElement: true
    };
  }
  function updateIframeBoxModelLayers(data) {
    // Remove old layers
    Object.values(S.boxModelLayers).forEach(layer => remove(layer));
    S.boxModelLayers = {};
    clearGridFlexOverlays();

    if (!data || !data.rect) return;

    const r = data.rect;
    const margin = data.marginValues;
    const padding = data.paddingValues;
    const border = data.borderValues;

    // Margin layer (Warm Orange - external spacing)
    const marginLayer = document.createElement("div");
    marginLayer.className = "di-box-layer di-box-margin";
    Object.assign(marginLayer.style, {
      position: "fixed",
      top: (r.top - margin[0]) + "px",
      left: (r.left - margin[3]) + "px",
      width: (r.width + margin[1] + margin[3]) + "px",
      height: (r.height + margin[0] + margin[2]) + "px",
      background: "rgba(255, 152, 0, 0.25)",
      border: "1px dashed rgba(255, 152, 0, 0.8)",
      boxShadow: "inset 0 0 0 1px rgba(255, 152, 0, 0.15)",
      zIndex: 99995,
      pointerEvents: "none",
      boxSizing: "border-box"
    });
    document.body.appendChild(marginLayer);
    S.boxModelLayers.margin = marginLayer;

    // Border layer (Golden Yellow - boundary)
    const borderLayer = document.createElement("div");
    borderLayer.className = "di-box-layer di-box-border";
    Object.assign(borderLayer.style, {
      position: "fixed",
      top: r.top + "px",
      left: r.left + "px",
      width: r.width + "px",
      height: r.height + "px",
      background: "rgba(255, 235, 59, 0.25)",
      border: "1px solid rgba(255, 235, 59, 0.9)",
      boxShadow: "inset 0 0 0 1px rgba(255, 235, 59, 0.2)",
      zIndex: 99996,
      pointerEvents: "none",
      boxSizing: "border-box"
    });
    document.body.appendChild(borderLayer);
    S.boxModelLayers.border = borderLayer;

    // Padding layer (Soft Green - internal space)
    const paddingWidth = r.width - border[1] - border[3];
    const paddingHeight = r.height - border[0] - border[2];

    if (paddingWidth > 0 && paddingHeight > 0) {
      const paddingLayer = document.createElement("div");
      paddingLayer.className = "di-box-layer di-box-padding";
      Object.assign(paddingLayer.style, {
        position: "fixed",
        top: (r.top + border[0]) + "px",
        left: (r.left + border[3]) + "px",
        width: paddingWidth + "px",
        height: paddingHeight + "px",
        background: "rgba(139, 195, 74, 0.25)",
        border: "1px dotted rgba(139, 195, 74, 0.8)",
        boxShadow: "inset 0 0 0 1px rgba(139, 195, 74, 0.15)",
        zIndex: 99997,
        pointerEvents: "none",
        boxSizing: "border-box"
      });
      document.body.appendChild(paddingLayer);
      S.boxModelLayers.padding = paddingLayer;
    }

    // Content layer (Cool Blue - core content)
    const contentWidth = r.width - border[1] - border[3] - padding[1] - padding[3];
    const contentHeight = r.height - border[0] - border[2] - padding[0] - padding[2];

    if (contentWidth > 0 && contentHeight > 0) {
      const contentLayer = document.createElement("div");
      contentLayer.className = "di-box-layer di-box-content";
      Object.assign(contentLayer.style, {
        position: "fixed",
        top: (r.top + border[0] + padding[0]) + "px",
        left: (r.left + border[3] + padding[3]) + "px",
        width: contentWidth + "px",
        height: contentHeight + "px",
        background: "rgba(33, 150, 243, 0.30)",
        border: "2px solid rgba(33, 150, 243, 0.95)",
        boxShadow: "inset 0 0 0 1px rgba(33, 150, 243, 0.2), 0 0 8px rgba(33, 150, 243, 0.3)",
        zIndex: 99998,
        pointerEvents: "none",
        boxSizing: "border-box"
      });
      document.body.appendChild(contentLayer);
      S.boxModelLayers.content = contentLayer;
    }

    // Add grid/flex overlays for iframe elements
    if (data.isIframeElement && data.el) {
      const iframe = S.viewportFrame?.iframe;
      if (iframe) {
        const iframeDoc = iframe.contentDocument;
        const cs = iframeDoc.defaultView.getComputedStyle(data.el);

        if (cs.display === 'grid' || cs.display === 'inline-grid') {
          addIframeGridOverlay(data);
        } else if (cs.display === 'flex' || cs.display === 'inline-flex') {
          addIframeFlexOverlay(data);
        }
      }
    }
  }
  function addIframeGridOverlay(data) {
    const r = data.rect;
    const overlay = document.createElement("div");
    overlay.className = "di-grid-overlay";

    Object.assign(overlay.style, {
      position: "fixed",
      top: r.top + "px",
      left: r.left + "px",
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
  function addIframeFlexOverlay(data) {
    const r = data.rect;
    const iframe = S.viewportFrame?.iframe;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument;
    const cs = iframeDoc.defaultView.getComputedStyle(data.el);
    const flexDirection = cs.flexDirection;

    const overlay = document.createElement("div");
    overlay.className = "di-flex-overlay";

    Object.assign(overlay.style, {
      position: "fixed",
      top: r.top + "px",
      left: r.left + "px",
      width: r.width + "px",
      height: r.height + "px",
      pointerEvents: "none",
      zIndex: 99998,
      border: "2px dashed rgba(59, 130, 246, 0.6)"
    });

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
  function positionHoverPanelForIframe(data) {
    if (!S.hoverPanel) return;

    const r = data.rect;
    const panelRect = S.hoverPanel.getBoundingClientRect();
    const OFFSET = 10;
    const VIEWPORT_PADDING = 10;

    let top, left;

    // Position relative to fixed iframe coordinates
    S.hoverPanel.style.position = "fixed";

    // Try above
    if (r.top - panelRect.height - OFFSET > VIEWPORT_PADDING) {
      top = r.top - panelRect.height - OFFSET;
      left = r.left;
    }
    // Try below
    else if (r.bottom + panelRect.height + OFFSET < window.innerHeight - VIEWPORT_PADDING) {
      top = r.bottom + OFFSET;
      left = r.left;
    }
    // Try right
    else if (r.right + panelRect.width + OFFSET < window.innerWidth - VIEWPORT_PADDING) {
      top = r.top;
      left = r.right + OFFSET;
    }
    // Try left
    else if (r.left - panelRect.width - OFFSET > VIEWPORT_PADDING) {
      top = r.top;
      left = r.left - panelRect.width - OFFSET;
    }
    // Fallback: top-left corner
    else {
      top = VIEWPORT_PADDING;
      left = VIEWPORT_PADDING;
    }

    // Constrain to viewport
    left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - panelRect.width - VIEWPORT_PADDING));
    top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - panelRect.height - VIEWPORT_PADDING));

    S.hoverPanel.style.top = top + "px";
    S.hoverPanel.style.left = left + "px";
  }
  function showCopyNotification() {
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
    font-family: system-ui, -apple-system, sans-serif;
  `;
    notification.textContent = '✓ CSS Copied to Clipboard!';
    document.body.appendChild(notification);

    setTimeout(() => remove(notification), 1500);
  }
  // Touch event simulation
  function enableTouchSimulation(iframeDoc) {
    // Convert mouse events to touch events
    iframeDoc.addEventListener('mousedown', (e) => {
      const touch = createTouchEvent('touchstart', e);
      e.target.dispatchEvent(touch);
    }, true);

    iframeDoc.addEventListener('mousemove', (e) => {
      if (e.buttons === 1) {
        const touch = createTouchEvent('touchmove', e);
        e.target.dispatchEvent(touch);
      }
    }, true);
    iframeDoc.addEventListener('mouseup', (e) => {
      const touch = createTouchEvent('touchend', e);
      e.target.dispatchEvent(touch);
    }, true);
  }
  function createTouchEvent(type, mouseEvent) {
    const touch = new Touch({
      identifier: 0,
      target: mouseEvent.target,
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY,
      pageX: mouseEvent.pageX,
      pageY: mouseEvent.pageY,
      screenX: mouseEvent.screenX,
      screenY: mouseEvent.screenY,
      radiusX: 10,
      radiusY: 10,
      force: 0.5
    });
    return new TouchEvent(type, {
      touches: type === 'touchend' ? [] : [touch],
      targetTouches: type === 'touchend' ? [] : [touch],
      changedTouches: [touch],
      bubbles: true,
      cancelable: true
    });
  }

  function createResponsivePanel() {
    if (S.responsivePanel) return;

    const panel = document.createElement("div");
    panel.className = "di-responsive-panel";
    Object.assign(panel.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      width: "320px",
      background: "rgba(30, 30, 30, 0.98)",
      color: "#fff",
      fontSize: "12px",
      borderRadius: "8px",
      zIndex: 100001,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.1)"
    });

    // Header
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "12px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "rgba(0,0,0,0.2)",
      borderRadius: "8px 8px 0 0"
    });

    const title = document.createElement("span");
    title.textContent = "📱 Responsive Design";
    title.style.fontWeight = "bold";
    title.style.fontSize = "13px";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    Object.assign(closeBtn.style, {
      background: "none",
      border: "none",
      color: "#fff",
      fontSize: "24px",
      cursor: "pointer",
      padding: "0",
      lineHeight: "1",
      width: "24px",
      height: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
      transition: "background 0.2s"
    });
    closeBtn.onmouseenter = () => closeBtn.style.background = "rgba(255,255,255,0.1)";
    closeBtn.onmouseleave = () => closeBtn.style.background = "none";
    closeBtn.onclick = exitResponsiveMode;

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = document.createElement("div");
    content.style.padding = "16px";

    // Current viewport display
    const currentDisplay = document.createElement("div");
    currentDisplay.className = "di-current-viewport";
    Object.assign(currentDisplay.style, {
      background: "rgba(0, 122, 204, 0.15)",
      padding: "12px",
      borderRadius: "6px",
      marginBottom: "16px",
      border: "1px solid rgba(0, 122, 204, 0.3)"
    });
    currentDisplay.innerHTML = `
    <div style="font-size: 11px; color: #999; margin-bottom: 4px;">Current Viewport</div>
    <div style="font-size: 16px; font-weight: bold; color: #4fc3f7;">
      <span id="di-viewport-width">${S.currentViewport.width}</span> × 
      <span id="di-viewport-height">${S.currentViewport.height}</span>
    </div>
    <div style="font-size: 10px; color: #999; margin-top: 4px;">
      <span id="di-viewport-name">${S.currentViewport.name}</span>
      <span id="di-viewport-scale" style="margin-left: 8px;"></span>
    </div>
  `;

    // Custom dimensions input
    const customSection = document.createElement("div");
    customSection.style.marginBottom = "16px";

    const customLabel = document.createElement("div");
    customLabel.textContent = "Custom Dimensions";
    customLabel.style.cssText = "font-size: 11px; color: #999; margin-bottom: 8px; font-weight: 500;";

    const inputContainer = document.createElement("div");
    inputContainer.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px;";

    const widthInput = document.createElement("input");
    widthInput.type = "number";
    widthInput.placeholder = "Width";
    widthInput.id = "di-custom-width";
    widthInput.min = "320";
    widthInput.max = "7680";
    widthInput.value = S.currentViewport.width;

    const heightInput = document.createElement("input");
    heightInput.type = "number";
    heightInput.placeholder = "Height";
    heightInput.id = "di-custom-height";
    heightInput.min = "240";
    heightInput.max = "4320";
    heightInput.value = S.currentViewport.height;

    [widthInput, heightInput].forEach(input => {
      Object.assign(input.style, {
        flex: "1",
        padding: "8px 10px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "4px",
        color: "#fff",
        fontSize: "12px",
        fontFamily: "monospace"
      });
      input.onfocus = () => input.style.borderColor = "#007acc";
      input.onblur = () => input.style.borderColor = "rgba(255,255,255,0.1)";
    });

    const applyCustomBtn = document.createElement("button");
    applyCustomBtn.textContent = "Apply";
    applyCustomBtn.className = "di-button";
    Object.assign(applyCustomBtn.style, {
      width: "100%",
      padding: "8px",
      background: "#007acc",
      border: "none",
      borderRadius: "4px",
      color: "#fff",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "500",
      transition: "background 0.2s"
    });
    applyCustomBtn.onmouseenter = () => applyCustomBtn.style.background = "#005a9e";
    applyCustomBtn.onmouseleave = () => applyCustomBtn.style.background = "#007acc";
    applyCustomBtn.onclick = () => {
      const w = parseInt(widthInput.value);
      const h = parseInt(heightInput.value);
      if (w >= 320 && h >= 240) {
        applyViewport({ name: 'Custom', width: w, height: h, type: 'custom' });
      }
    };

    inputContainer.appendChild(widthInput);
    inputContainer.appendChild(heightInput);
    customSection.appendChild(customLabel);
    customSection.appendChild(inputContainer);
    customSection.appendChild(applyCustomBtn);

    // Rotation button
    const rotateBtn = document.createElement("button");
    rotateBtn.textContent = "🔄 Rotate (90°)";
    rotateBtn.className = "di-button";
    Object.assign(rotateBtn.style, {
      width: "100%",
      padding: "8px",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "4px",
      color: "#fff",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "500",
      marginBottom: "16px",
      transition: "all 0.2s"
    });
    rotateBtn.onmouseenter = () => {
      rotateBtn.style.background = "rgba(255,255,255,0.1)";
      rotateBtn.style.borderColor = "#007acc";
    };
    rotateBtn.onmouseleave = () => {
      rotateBtn.style.background = "rgba(255,255,255,0.05)";
      rotateBtn.style.borderColor = "rgba(255,255,255,0.1)";
    };
    rotateBtn.onclick = () => {
      const temp = S.currentViewport.width;
      applyViewport({
        ...S.currentViewport,
        width: S.currentViewport.height,
        height: temp
      });
      widthInput.value = S.currentViewport.width;
      heightInput.value = S.currentViewport.height;
    };

    // Presets section
    const presetsLabel = document.createElement("div");
    presetsLabel.textContent = "Device Presets";
    presetsLabel.style.cssText = "font-size: 11px; color: #999; margin-bottom: 8px; font-weight: 500;";

    const presetsContainer = document.createElement("div");
    presetsContainer.style.cssText = "max-height: 300px; overflow-y: auto; margin-bottom: 12px;";

    // Group presets by type
    const groupedPresets = {
      mobile: viewportPresets.filter(p => p.type === 'mobile'),
      tablet: viewportPresets.filter(p => p.type === 'tablet'),
      desktop: viewportPresets.filter(p => p.type === 'desktop')
    };

    const typeIcons = {
      mobile: '📱',
      tablet: '📟',
      desktop: '🖥️'
    };

    const typeLabels = {
      mobile: 'Mobile Devices',
      tablet: 'Tablets',
      desktop: 'Desktops'
    };

    Object.entries(groupedPresets).forEach(([type, presets]) => {
      if (presets.length === 0) return;

      const groupLabel = document.createElement("div");
      groupLabel.textContent = `${typeIcons[type]} ${typeLabels[type]}`;
      groupLabel.style.cssText = "font-size: 10px; color: #666; margin: 12px 0 6px 0; font-weight: 600; text-transform: uppercase;";
      presetsContainer.appendChild(groupLabel);

      presets.forEach(preset => {
        const presetBtn = document.createElement("button");
        presetBtn.className = "di-preset-btn";
        presetBtn.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span style="font-weight: 500;">${preset.name}</span>
          <span style="font-size: 10px; color: #999; font-family: monospace;">${preset.width} × ${preset.height}</span>
        </div>
      `;
        Object.assign(presetBtn.style, {
          width: "100%",
          padding: "10px 12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "6px",
          color: "#fff",
          cursor: "pointer",
          fontSize: "12px",
          marginBottom: "6px",
          transition: "all 0.2s",
          textAlign: "left"
        });

        presetBtn.onmouseenter = () => {
          presetBtn.style.background = "rgba(0, 122, 204, 0.15)";
          presetBtn.style.borderColor = "#007acc";
          presetBtn.style.transform = "translateX(2px)";
        };
        presetBtn.onmouseleave = () => {
          presetBtn.style.background = "rgba(255,255,255,0.03)";
          presetBtn.style.borderColor = "rgba(255,255,255,0.08)";
          presetBtn.style.transform = "translateX(0)";
        };

        presetBtn.onclick = () => {
          applyViewport(preset);
          widthInput.value = preset.width;
          heightInput.value = preset.height;
        };

        presetsContainer.appendChild(presetBtn);
      });
    });

    // Reset button
    // const resetBtn = document.createElement("button");
    // resetBtn.textContent = "↺ Reset to Full Screen";
    // resetBtn.className = "di-button";
    // Object.assign(resetBtn.style, {
    //   width: "100%",
    //   padding: "10px",
    //   background: "rgba(220, 53, 69, 0.2)",
    //   border: "1px solid rgba(220, 53, 69, 0.5)",
    //   borderRadius: "6px",
    //   color: "#ff6b6b",
    //   cursor: "pointer",
    //   fontSize: "12px",
    //   fontWeight: "500",
    //   transition: "all 0.2s"
    // });
    // resetBtn.onmouseenter = () => {
    //   resetBtn.style.background = "rgba(220, 53, 69, 0.3)";
    //   resetBtn.style.borderColor = "#dc3545";
    // };
    // resetBtn.onmouseleave = () => {
    //   resetBtn.style.background = "rgba(220, 53, 69, 0.2)";
    //   resetBtn.style.borderColor = "rgba(220, 53, 69, 0.5)";
    // };
    // resetBtn.onclick = resetViewport;

    content.appendChild(currentDisplay);
    content.appendChild(customSection);
    content.appendChild(rotateBtn);
    content.appendChild(presetsLabel);
    content.appendChild(presetsContainer);
    // content.appendChild(resetBtn);

    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);

    S.responsivePanel = panel;
  }

  function enterResponsiveMode() {
    if (S.responsiveMode) return;

    S.responsiveMode = true;
    setState(STATES.SELECTED);

    createViewportFrame();
    createResponsivePanel();

    // Set initial viewport to current window size
    S.currentViewport = {
      name: 'Current',
      width: window.innerWidth,
      height: window.innerHeight,
      type: 'desktop'
    };

    console.log('[DOM Inspector] Responsive mode activated');
  }

  function exitResponsiveMode() {
    if (!S.responsiveMode) return;
    S.responsiveMode = false;
    // Remove UI elements
    if (S.responsivePanel) {
      remove(S.responsivePanel);
      S.responsivePanel = null;
    }
    if (S.viewportFrame) {
      // Remove all viewport frame components
      remove(S.viewportFrame.overlay);
      remove(S.viewportFrame.toolbar);
      S.viewportFrame = null;
    }
    // Clean up iframe handlers if they exist
    if (S.iframeHandlers) {
      S.iframeHandlers = null;
    }
    setState(STATES.IDLE);
    console.log('[DOM Inspector] Responsive mode deactivated');
  }

  /*  PSEUDO-STATE INSPECTOR  */
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

  /*  SELECTED ITEMS  */
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

  /*  CLEANUP  */
  function cleanup() {
    console.log('[DOM Inspector] Cleaning up...');
    setState(STATES.CLEANING);

    detachEventListeners();
    stopDrag();

    // Exit responsive mode if active
    if (S.responsiveMode) {
      exitResponsiveMode();
    }

    // NEW: Clean up iframe handlers
    if (S.iframeHandlers && S.viewportFrame?.iframe) {
      const iframeDoc = S.viewportFrame.iframe.contentDocument;
      if (iframeDoc) {
        iframeDoc.removeEventListener("mousemove", S.iframeHandlers.mousemove);
        iframeDoc.removeEventListener("click", S.iframeHandlers.click, true);
        iframeDoc.removeEventListener("keydown", S.iframeHandlers.keydown);
      }
      S.iframeHandlers = null;
    }

    // Cancel all pending operations
    if (S.rafId) {
      cancelAnimationFrame(S.rafId);
      S.rafId = null;
    }

    if (S.scrollTimeout) {
      clearTimeout(S.scrollTimeout);
      S.scrollTimeout = null;
    }

    if (cacheInvalidationFrame) {
      cancelAnimationFrame(cacheInvalidationFrame);
      cacheInvalidationFrame = null;
    }

    // Clear cache
    elementDataCache.clear();

    // Disconnect resize observer
    if (S.resizeObserver) {
      S.resizeObserver.disconnect();
      S.resizeObserver = null;
    }

    // Remove UI elements
    remove(S.hoverPanel);
    remove(S.panelContainer);
    remove(S.inspectBtn);

    // Remove responsive button
    const responsiveBtn = document.getElementById("dom-responsive-btn");
    if (responsiveBtn) remove(responsiveBtn);

    Object.values(S.boxModelLayers).forEach(layer => remove(layer));
    clearGridFlexOverlays();

    // Clean up selected items
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

    // Reset all state
    S.hoverPanel = null;
    S.panelContainer = null;
    S.inspectBtn = null;
    S.responsivePanel = null;
    S.viewportFrame = null;
    S.responsiveMode = false;
    S.boxModelLayers = {};
    S.gridFlexOverlays = [];
    S.selectedItems = [];
    S.lastHoveredElement = null;
    S.pendingMouseEvent = null;
    S.scrollTimeout = null;
    S.panelX = null;
    S.panelY = null;
    S.isDragging = false;

    document.body.style.cursor = "default";
    window.__DOM_INSPECTOR__ = false;

    console.log('[DOM Inspector] Cleanup complete');
  }

  /*  MESSAGES  */
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
  console.log('  ✓ Responsive Design Testing');
})();