(() => {
  if (window.__DOM_INSPECTOR__) return;
  window.__DOM_INSPECTOR__ = true;

  const S = {
    inspecting: false,
    hoverOverlay: null,
    hoverPanel: null,
    panelContainer: null,
    inspectBtn: null,
    selectedItems: []
  };

  /* ---------------- UTILS ---------------- */
  const remove = (el) => el && el.remove();

  const cssText = (d) => `
${d.selector} {
  /* Box Model */
  width: ${d.width};
  height: ${d.height};
  margin: ${d.margin};
  padding: ${d.padding};
  
  /* Display & Position */
  display: ${d.display};
  position: ${d.position};
  top: ${d.top};
  left: ${d.left};
  right: ${d.right};
  bottom: ${d.bottom};
  z-index: ${d.zIndex};
  
  /* Colors & Background */
  color: ${d.color};
  background: ${d.background};
  opacity: ${d.opacity};
  
  /* Typography */
  font-size: ${d.fontSize};
  font-family: ${d.fontFamily};
  font-weight: ${d.fontWeight};
  line-height: ${d.lineHeight};
  text-align: ${d.textAlign};
  letter-spacing: ${d.letterSpacing};
  text-transform: ${d.textTransform};
  text-decoration: ${d.textDecoration};
  
  /* Border & Effects */
  border: ${d.border};
  border-radius: ${d.borderRadius};
  box-shadow: ${d.boxShadow};
  outline: ${d.outline};
  
  /* Flexbox */
  flex-direction: ${d.flexDirection};
  justify-content: ${d.justifyContent};
  align-items: ${d.alignItems};
  flex-wrap: ${d.flexWrap};
  gap: ${d.gap};
  
  /* Grid */
  grid-template-columns: ${d.gridTemplateColumns};
  grid-template-rows: ${d.gridTemplateRows};
  grid-gap: ${d.gridGap};
  
  /* Other */
  overflow: ${d.overflow};
  cursor: ${d.cursor};
  transition: ${d.transition};
  transform: ${d.transform};
}`.trim();

  const getData = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    
    // Build selector
    let selector = el.tagName.toLowerCase();
    if (el.id) selector += "#" + el.id;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) selector += "." + classes.join(".");
    }
    
    return {
      el,
      rect: r,
      selector: selector,
      // Box Model
      fontSize: cs.fontSize,
      color: cs.color,
      background: cs.backgroundColor,
      margin: cs.margin,
      padding: cs.padding,
      width: Math.round(r.width) + "px",
      height: Math.round(r.height) + "px",
      // Display & Position
      display: cs.display,
      position: cs.position,
      top: cs.top,
      left: cs.left,
      right: cs.right,
      bottom: cs.bottom,
      zIndex: cs.zIndex,
      // Typography
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      textAlign: cs.textAlign,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      textDecoration: cs.textDecoration,
      // Border & Effects
      border: cs.border,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
      outline: cs.outline,
      // Flexbox
      flexDirection: cs.flexDirection,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
      flexWrap: cs.flexWrap,
      gap: cs.gap,
      // Grid
      gridTemplateColumns: cs.gridTemplateColumns,
      gridTemplateRows: cs.gridTemplateRows,
      gridGap: cs.gridGap,
      // Other
      opacity: cs.opacity,
      overflow: cs.overflow,
      cursor: cs.cursor,
      transition: cs.transition,
      transform: cs.transform
    };
  };

  const isInspectorElement = (el) => {
    // Check if element is part of the inspector UI
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
           el.classList.contains('di-button');
  };

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
      cursor: "pointer"
    });
    btn.onclick = (e) => {
      e.stopPropagation();
      startInspect();
    };
    document.body.appendChild(btn);
    S.inspectBtn = btn;
  }

  function ensureHoverUI() {
    if (!S.hoverOverlay) {
      S.hoverOverlay = document.createElement("div");
      S.hoverOverlay.className = "di-hover-overlay";
      Object.assign(S.hoverOverlay.style, {
        position: "absolute",
        pointerEvents: "none",
        border: "2px dashed red",
        background: "rgba(255,0,0,.1)",
        zIndex: 99998
      });
      document.body.appendChild(S.hoverOverlay);
    }

    if (!S.hoverPanel) {
      S.hoverPanel = document.createElement("div");
      S.hoverPanel.className = "di-hover-panel";
      Object.assign(S.hoverPanel.style, {
        position: "fixed",
        top: "10px",
        left: "10px",
        width: "400px",
        maxHeight: "85vh",
        overflow: "auto",
        background: "#222",
        color: "#fff",
        fontSize: "12px",
        padding: "10px",
        borderRadius: "6px",
        zIndex: 99999,
        pointerEvents: "none",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
      });
      document.body.appendChild(S.hoverPanel);
    }
  }

  function ensurePanelContainer() {
    if (!S.panelContainer) {
      S.panelContainer = document.createElement("div");
      S.panelContainer.className = "di-selected-panel";
      Object.assign(S.panelContainer.style, {
        position: "fixed",
        top: "10px",
        right: "10px",
        width: "320px",
        maxHeight: "80vh",
        overflow: "auto",
        background: "#1e1e1e",
        color: "#fff",
        fontSize: "12px",
        padding: "10px",
        borderRadius: "6px",
        zIndex: 99999
      });
      document.body.appendChild(S.panelContainer);
    }
  }

  /* ---------------- INSPECT FLOW ---------------- */
  function startInspect() {
    S.inspecting = true;
    document.body.style.cursor = "crosshair";
    ensureInspectButton();
    ensureHoverUI();
    
    // Update button text to show active state
    if (S.inspectBtn) {
      S.inspectBtn.textContent = "Inspecting...";
      S.inspectBtn.style.background = "#ff6600";
    }
  }

  function stopInspect() {
    S.inspecting = false;
    document.body.style.cursor = "default";
    
    // Reset button
    if (S.inspectBtn) {
      S.inspectBtn.textContent = "Inspect";
      S.inspectBtn.style.background = "#007acc";
    }
  }

  /* ---------------- SELECTED ITEMS ---------------- */
  function addSelected(data) {
    ensurePanelContainer();

    // Green overlay
    const overlay = document.createElement("div");
    overlay.className = "di-selected-overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      top: data.rect.top + "px",
      left: data.rect.left + "px",
      width: data.rect.width + "px",
      height: data.rect.height + "px",
      border: "2px solid lime",
      background: "rgba(0,255,0,.1)",
      zIndex: 99997,
      pointerEvents: "none"
    });
    document.body.appendChild(overlay);

    // Panel item
    const item = document.createElement("div");
    item.className = "di-panel-item";
    item.style.borderBottom = "1px solid #444";
    item.style.marginBottom = "8px";
    item.style.paddingBottom = "4px";
    
    // Create collapsible CSS display
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
    `;
    cssPreview.textContent = cssText(data);

    // Buttons
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
      cursor: "pointer"
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
    S.panelContainer.appendChild(item);

    S.selectedItems.push({ overlay, item });
  }

  /* ---------------- EVENTS ---------------- */
  document.addEventListener("mousemove", (e) => {
    if (!S.inspecting) return;
    
    // Skip inspector elements
    if (isInspectorElement(e.target)) {
      if (S.hoverOverlay) S.hoverOverlay.style.display = "none";
      if (S.hoverPanel) S.hoverPanel.style.display = "none";
      return;
    }
    
    const d = getData(e.target);
    if (S.hoverOverlay) {
      S.hoverOverlay.style.display = "block";
      Object.assign(S.hoverOverlay.style, {
        top: d.rect.top + "px",
        left: d.rect.left + "px",
        width: d.rect.width + "px",
        height: d.rect.height + "px"
      });
    }
    if (S.hoverPanel) {
      S.hoverPanel.style.display = "block";
      
      // Create header with shortcuts
      const header = `
        <div style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 8px;">
          <b style="font-size: 14px;">${d.selector}</b>
          <div style="color: #999; margin-top: 4px;">${d.width} × ${d.height}</div>
        </div>
        <div style="background: #2d2d2d; padding: 8px; margin-bottom: 10px; border-radius: 4px; font-size: 11px;">
          <div style="color: #4fc3f7; margin-bottom: 4px;">⌨️ Keyboard Shortcuts:</div>
          <div style="color: #aaa; line-height: 1.6;">
            <div><kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Click</kbd> Select element</div>
            <div><kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Esc</kbd> Exit inspect mode</div>
            <div><kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-size: 10px;">C</kbd> Copy CSS (when hovering)</div>
          </div>
        </div>
      `;
      
      // Create CSS preview
      const cssPreviewText = cssText(d);
      const cssPreview = `<pre style="background: #2d2d2d; padding: 8px; margin: 0; border-radius: 4px; font-size: 10px; overflow-x: auto; max-height: 400px; overflow-y: auto; white-space: pre-wrap; line-height: 1.4;">${cssPreviewText}</pre>`;
      
      S.hoverPanel.innerHTML = header + cssPreview;
    }
  });

  document.addEventListener("click", (e) => {
    if (!S.inspecting) return;
    
    // Skip inspector elements
    if (isInspectorElement(e.target)) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    addSelected(getData(e.target));
    stopInspect();
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (!S.inspecting) return;
    
    // Esc - Exit inspect mode
    if (e.key === "Escape") {
      e.preventDefault();
      stopInspect();
    }
    
    // C - Copy CSS of currently hovered element
    if (e.key === "c" || e.key === "C") {
      const hoveredEl = document.elementFromPoint(e.clientX || 0, e.clientY || 0);
      if (hoveredEl && !isInspectorElement(hoveredEl)) {
        e.preventDefault();
        const data = getData(hoveredEl);
        navigator.clipboard.writeText(cssText(data));
        
        // Show feedback
        if (S.hoverPanel) {
          const originalContent = S.hoverPanel.innerHTML;
          S.hoverPanel.innerHTML = '<div style="padding: 20px; text-align: center; color: #4caf50; font-size: 14px;">✓ CSS Copied!</div>';
          setTimeout(() => {
            if (S.inspecting) {
              // Refresh with current hover state
              const currentEl = document.elementFromPoint(e.clientX || 0, e.clientY || 0);
              if (currentEl && !isInspectorElement(currentEl)) {
                const d = getData(currentEl);
                const header = `
                  <div style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 8px;">
                    <b style="font-size: 14px;">${d.selector}</b>
                    <div style="color: #999; margin-top: 4px;">${d.width} × ${d.height}</div>
                  </div>
                  <div style="background: #2d2d2d; padding: 8px; margin-bottom: 10px; border-radius: 4px; font-size: 11px;">
                    <div style="color: #4fc3f7; margin-bottom: 4px;">⌨️ Keyboard Shortcuts:</div>
                    <div style="color: #aaa; line-height: 1.6;">
                      <div><kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Click</kbd> Select element</div>
                      <div><kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Esc</kbd> Exit inspect mode</div>
                      <div><kbd style="background: #444; padding: 2px 6px; border-radius: 3px; font-size: 10px;">C</kbd> Copy CSS (when hovering)</div>
                    </div>
                  </div>
                `;
                const cssPreview = `<pre style="background: #2d2d2d; padding: 8px; margin: 0; border-radius: 4px; font-size: 10px; overflow-x: auto; max-height: 400px; overflow-y: auto; white-space: pre-wrap; line-height: 1.4;">${cssText(d)}</pre>`;
                S.hoverPanel.innerHTML = header + cssPreview;
              }
            }
          }, 800);
        }
      }
    }
  });

  /* ---------------- MESSAGES ---------------- */
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_INSPECT") startInspect();
    if (msg.type === "CLEAR_OVERLAY") {
      stopInspect();

      remove(S.hoverOverlay);
      remove(S.hoverPanel);
      remove(S.panelContainer);
      remove(S.inspectBtn);

      S.hoverOverlay = S.hoverPanel = S.panelContainer = S.inspectBtn = null;

      S.selectedItems.forEach(i => remove(i.overlay));
      S.selectedItems.length = 0;
    }
  });

  // Auto-create floating button initially
  ensureInspectButton();
})();