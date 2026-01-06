(() => {
  if (window.__DOM_INSPECTOR__) return;
  window.__DOM_INSPECTOR__ = true;

  const S = {
    inspecting: false,
    hoverOverlay: null,
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
    dragOffsetY: 0
  };

  /* ---------------- UTILS ---------------- */
  const remove = (el) => el && el.remove();

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
      const classes = el.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) selector += "." + classes.join(".");
    }
    
    // Parse individual margin/padding values
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
    return el === S.inspectBtn || 
           el === S.hoverOverlay || 
           el === S.hoverPanel || 
           el === S.panelContainer ||
           (S.panelContainer && S.panelContainer.contains(el)) ||
           el.classList.contains('di-inspect-btn') ||
           el.classList.contains('di-hover-overlay') ||
           el.classList.contains('di-hover-panel') ||
           el.classList.contains('di-selected-panel') ||
           el.classList.contains('di-selected-overlay') ||
           el.classList.contains('di-panel-item') ||
           el.classList.contains('di-button') ||
           el.classList.contains('di-box-layer') ||
           el.classList.contains('di-panel-header') ||
           el.classList.contains('di-collapse-btn');
  };

  /* ---------------- BOX MODEL VISUALIZATION ---------------- */
  function updateBoxModelLayers(data) {
    // Remove old layers
    Object.values(S.boxModelLayers).forEach(layer => remove(layer));
    S.boxModelLayers = {};
    
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
      pointerEvents: "none"
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
      pointerEvents: "none"
    });
    document.body.appendChild(borderLayer);
    S.boxModelLayers.border = borderLayer;
    
    // Padding + Content layer (blue)
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
        pointerEvents: "none"
      });
      document.body.appendChild(contentLayer);
      S.boxModelLayers.content = contentLayer;
    }
  }

  function hideBoxModelLayers() {
    Object.values(S.boxModelLayers).forEach(layer => {
      if (layer) layer.style.display = "none";
    });
  }

  function showBoxModelLayers() {
    Object.values(S.boxModelLayers).forEach(layer => {
      if (layer) layer.style.display = "block";
    });
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
      fontFamily: "system-ui, -apple-system, sans-serif"
    });
    btn.onclick = (e) => {
      e.stopPropagation();
      startInspect();
    };
    document.body.appendChild(btn);
    S.inspectBtn = btn;
  }

  function ensureHoverUI() {
    if (!S.hoverPanel) {
      S.hoverPanel = document.createElement("div");
      S.hoverPanel.className = "di-hover-panel";
      Object.assign(S.hoverPanel.style, {
        position: "fixed",
        top: "10px",
        left: "10px",
        background: "#222",
        color: "#fff",
        fontSize: "11px",
        padding: "8px 10px",
        borderRadius: "6px",
        zIndex: 99999,
        pointerEvents: "none",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        maxWidth: "350px",
        fontFamily: "system-ui, -apple-system, monospace"
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
        background: "#1e1e1e",
        color: "#fff",
        fontSize: "12px",
        borderRadius: "6px",
        zIndex: 99999,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        fontFamily: "system-ui, -apple-system, sans-serif"
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
    const content = S.panelContainer.querySelector(".di-panel-content");
    const collapseBtn = S.panelContainer.querySelector(".di-collapse-btn");
    
    if (S.panelCollapsed) {
      content.style.display = "none";
      collapseBtn.textContent = "+";
    } else {
      content.style.display = "block";
      collapseBtn.textContent = "−";
    }
  }

  function startDrag(e) {
    S.isDragging = true;
    const rect = S.panelContainer.getBoundingClientRect();
    S.dragOffsetX = e.clientX - rect.left;
    S.dragOffsetY = e.clientY - rect.top;
    
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDrag);
  }

  function drag(e) {
    if (!S.isDragging) return;
    
    const x = e.clientX - S.dragOffsetX;
    const y = e.clientY - S.dragOffsetY;
    
    S.panelX = Math.max(0, Math.min(x, window.innerWidth - S.panelContainer.offsetWidth));
    S.panelY = Math.max(0, Math.min(y, window.innerHeight - 50));
    
    S.panelContainer.style.left = S.panelX + "px";
    S.panelContainer.style.top = S.panelY + "px";
  }

  function stopDrag() {
    S.isDragging = false;
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", stopDrag);
  }

  /* ---------------- INSPECT FLOW ---------------- */
  function startInspect() {
    S.inspecting = true;
    document.body.style.cursor = "crosshair";
    ensureInspectButton();
    ensureHoverUI();
    
    if (S.inspectBtn) {
      S.inspectBtn.textContent = "Inspecting...";
      S.inspectBtn.style.background = "#ff6600";
    }
  }

  function stopInspect() {
    S.inspecting = false;
    document.body.style.cursor = "default";
    
    if (S.inspectBtn) {
      S.inspectBtn.textContent = "Inspect";
      S.inspectBtn.style.background = "#007acc";
    }
    
    hideBoxModelLayers();
  }

  /* ---------------- SELECTED ITEMS ---------------- */
  function addSelected(data) {
    ensurePanelContainer();

    const overlay = document.createElement("div");
    overlay.className = "di-selected-overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      top: (data.rect.top + window.scrollY) + "px",
      left: (data.rect.left + window.scrollX) + "px",
      width: data.rect.width + "px",
      height: data.rect.height + "px",
      border: "2px solid lime",
      background: "rgba(0,255,0,.1)",
      zIndex: 99994,
      pointerEvents: "none"
    });
    document.body.appendChild(overlay);

    const item = document.createElement("div");
    item.className = "di-panel-item";
    item.style.borderBottom = "1px solid #444";
    item.style.marginBottom = "8px";
    item.style.paddingBottom = "4px";
    
    const header = document.createElement("div");
    header.innerHTML = `<b>${data.selector}</b><div style="color: #999;">${data.width} × ${data.height}</div>`;
    
    const cssPreview = document.createElement("pre");
    cssPreview.className = "di-css-preview";
    cssPreview.style.cssText = `
      background: #2d2d2d;
      padding: 8px;
      margin: 8px 0;
      border-radius: 4px;
      font-size: 11px;
      overflow-x: auto;
      max-height: 200px;
      overflow-y: auto;
      font-family: monospace;
    `;
    cssPreview.textContent = cssText(data);

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
    clearBtn.textContent = "Clear";

    [copyBtn, clearBtn].forEach(b => Object.assign(b.style, {
      marginTop: "6px",
      marginRight: "6px",
      padding: "4px 8px",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }));

    copyBtn.style.background = "#007acc";
    copyBtn.style.color = "#fff";
    clearBtn.style.background = "#cc0000";
    clearBtn.style.color = "#fff";

    clearBtn.onclick = () => {
      remove(overlay);
      remove(item);
      S.selectedItems = S.selectedItems.filter(i => i.item !== item);

      if (S.selectedItems.length === 0) {
        remove(S.panelContainer);
        remove(S.hoverPanel);
        S.panelContainer = null;
        S.hoverPanel = null;
      }
    };

    item.append(header, cssPreview, copyBtn, clearBtn);
    const content = S.panelContainer.querySelector(".di-panel-content");
    content.appendChild(item);

    S.selectedItems.push({ overlay, item });
  }

  /* ---------------- EVENTS ---------------- */
  document.addEventListener("mousemove", (e) => {
    if (!S.inspecting) return;
    
    if (isInspectorElement(e.target)) {
      hideBoxModelLayers();
      if (S.hoverPanel) S.hoverPanel.style.display = "none";
      return;
    }
    
    const d = getData(e.target);
    
    updateBoxModelLayers(d);
    
    if (S.hoverPanel) {
      S.hoverPanel.style.display = "block";
      
      // Show important properties
      const props = [];
      props.push(`<b style="color: #4fc3f7;">${d.selector}</b>`);
      props.push(`<span style="color: #999;">${d.width} × ${d.height}</span>`);
      
      if (d.display !== 'inline') {
        props.push(`display: <span style="color: #f9d71c;">${d.display}</span>`);
      }
      
      if (d.position !== 'static') {
        props.push(`position: <span style="color: #f9d71c;">${d.position}</span>`);
      }
      
      if (d.margin !== '0px') {
        props.push(`margin: <span style="color: #f6b26b;">${d.margin}</span>`);
      }
      
      if (d.padding !== '0px') {
        props.push(`padding: <span style="color: #8bc3f5;">${d.padding}</span>`);
      }
      
      if (d.fontSize) {
        props.push(`font: <span style="color: #b5cea8;">${d.fontSize}</span>`);
      }
      
      if (d.color && d.color !== 'rgb(0, 0, 0)') {
        props.push(`color: <span style="color: ${d.color};">${d.color}</span>`);
      }
      
      S.hoverPanel.innerHTML = props.join('<br>');
    }
  });

  document.addEventListener("click", (e) => {
    if (!S.inspecting) return;
    
    if (isInspectorElement(e.target)) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    addSelected(getData(e.target));
    stopInspect();
  });

  document.addEventListener("keydown", (e) => {
    if (!S.inspecting) return;
    
    if (e.key === "Escape") {
      e.preventDefault();
      stopInspect();
    }
    
    if (e.key === "c" || e.key === "C") {
      const hoveredEl = document.elementFromPoint(e.clientX || 0, e.clientY || 0);
      if (hoveredEl && !isInspectorElement(hoveredEl)) {
        e.preventDefault();
        const data = getData(hoveredEl);
        navigator.clipboard.writeText(cssText(data));
        
        if (S.hoverPanel) {
          S.hoverPanel.innerHTML = '<div style="color: #4caf50; text-align: center;">✓ CSS Copied!</div>';
          setTimeout(() => {
            const currentEl = document.elementFromPoint(e.clientX || 0, e.clientY || 0);
            if (currentEl && !isInspectorElement(currentEl) && S.inspecting) {
              const d = getData(currentEl);
              const props = [];
              props.push(`<b style="color: #4fc3f7;">${d.selector}</b>`);
              props.push(`<span style="color: #999;">${d.width} × ${d.height}</span>`);
              if (d.display !== 'inline') props.push(`display: <span style="color: #f9d71c;">${d.display}</span>`);
              if (d.position !== 'static') props.push(`position: <span style="color: #f9d71c;">${d.position}</span>`);
              if (d.margin !== '0px') props.push(`margin: <span style="color: #f6b26b;">${d.margin}</span>`);
              if (d.padding !== '0px') props.push(`padding: <span style="color: #8bc3f5;">${d.padding}</span>`);
              if (d.fontSize) props.push(`font: <span style="color: #b5cea8;">${d.fontSize}</span>`);
              if (d.color && d.color !== 'rgb(0, 0, 0)') props.push(`color: <span style="color: ${d.color};">${d.color}</span>`);
              S.hoverPanel.innerHTML = props.join('<br>');
            }
          }, 800);
        }
      }
    }
  });

  // Handle scrolling - update box model layers
  let scrollTimeout;
  document.addEventListener("scroll", () => {
    if (!S.inspecting) return;
    
    hideBoxModelLayers();
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (S.inspecting) {
        const hoveredEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        if (hoveredEl && !isInspectorElement(hoveredEl)) {
          updateBoxModelLayers(getData(hoveredEl));
        }
      }
    }, 50);
  }, true);

  /* ---------------- MESSAGES ---------------- */
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "START_INSPECT") startInspect();
      if (msg.type === "CLEAR_OVERLAY") {
        stopInspect();

        remove(S.hoverPanel);
        remove(S.panelContainer);
        remove(S.inspectBtn);
        Object.values(S.boxModelLayers).forEach(layer => remove(layer));

        S.hoverPanel = S.panelContainer = S.inspectBtn = null;
        S.boxModelLayers = {};

        S.selectedItems.forEach(i => remove(i.overlay));
        S.selectedItems.length = 0;
      }
    });
  }

  ensureInspectButton();
})();