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
    buttonsVisible: false,
    fabMenuOpen: false,
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
    originalBodyOverflow: undefined,
    rulerMode: false,
    rulerLines: [],
    measurementLabels: [],
    firstSelectedElement: null,
    outlineMode: false,
    outlineStyleElement: null,
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

  // NEW FUNCTION - Detects if element has pseudo-state styles
  const getPseudoStateStyles = (el) => {
    const pseudoStates = {
      hover: null,
      focus: null,
      active: null,
      'focus-visible': null
    };

    try {
      // Get all stylesheets
      const sheets = Array.from(document.styleSheets);

      // Helper to check if selector matches element
      const selectorMatchesElement = (selector, element) => {
        try {
          // Remove pseudo-class from selector to test base match
          const baseSelector = selector.replace(/:(hover|focus|active|focus-visible).*/, '').trim();
          if (!baseSelector) return false;
          return element.matches(baseSelector);
        } catch (e) {
          return false;
        }
      };

      sheets.forEach(sheet => {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) return;

          Array.from(rules).forEach(rule => {
            if (rule.type !== CSSRule.STYLE_RULE) return;

            const selector = rule.selectorText;
            if (!selector) return;

            // Check each pseudo-state
            ['hover', 'focus', 'active', 'focus-visible'].forEach(state => {
              const pseudoRegex = new RegExp(`:${state}\\b`);

              if (pseudoRegex.test(selector) && selectorMatchesElement(selector, el)) {
                // Found matching pseudo-state rule
                const cssText = rule.style.cssText;

                if (cssText && cssText.trim()) {
                  if (!pseudoStates[state]) {
                    pseudoStates[state] = [];
                  }

                  // Parse individual properties
                  const properties = {};
                  Array.from(rule.style).forEach(prop => {
                    properties[prop] = rule.style.getPropertyValue(prop);
                  });

                  pseudoStates[state].push({
                    selector: selector,
                    properties: properties,
                    cssText: cssText
                  });
                }
              }
            });
          });
        } catch (e) {
          // CORS or other sheet access error - skip
        }
      });
    } catch (error) {
      console.warn('[DOM Inspector] Error detecting pseudo-states:', error);
    }

    return pseudoStates;
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
      (S.inspectBtn && S.inspectBtn.contains(el)) ||
      (S.panelContainer && S.panelContainer.contains(el)) ||
      el.classList.contains('di-fab-container') ||
      el.classList.contains('di-fab-menu') ||
      el.classList.contains('di-fab-menu-item') ||
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

  /*  UI CREATION - FLOATING ACTION BUTTON  */
  function ensureInspectButton() {
    if (S.inspectBtn) return;

    // Main FAB Container
    const fabContainer = document.createElement("div");
    fabContainer.id = "dom-inspector-fab";
    fabContainer.className = "di-fab-container";
    Object.assign(fabContainer.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: 100000,
      fontFamily: "system-ui, -apple-system, sans-serif"
    });

    // FAB Menu (hidden by default)
    const fabMenu = document.createElement("div");
    fabMenu.className = "di-fab-menu";
    Object.assign(fabMenu.style, {
      position: "absolute",
      bottom: "70px",
      right: "0",
      display: "none",
      flexDirection: "column",
      gap: "12px",
      alignItems: "flex-end"
    });

    // Helper function to create FAB menu item
    const createFabMenuItem = (id, icon, text, color, onClick) => {
      const item = document.createElement("div");
      item.className = "di-fab-menu-item";
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      `;

      const label = document.createElement("span");
      label.textContent = text;
      label.style.cssText = `
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;

      const button = document.createElement("button");
      button.id = id;
      button.innerHTML = icon;
      Object.assign(button.style, {
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        border: "none",
        background: color,
        color: "#fff",
        fontSize: "20px",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      });

      button.onmouseenter = () => {
        button.style.transform = "scale(1.1)";
        button.style.boxShadow = "0 6px 16px rgba(0,0,0,0.4)";
      };

      button.onmouseleave = () => {
        button.style.transform = "scale(1)";
        button.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      };

      button.onclick = (e) => {
        e.stopPropagation();
        onClick();
      };

      item.appendChild(label);
      item.appendChild(button);
      return item;
    };

    // Create menu items
    const inspectItem = createFabMenuItem(
      "dom-inspector-btn",
      "🔍",
      "Inspect Element",
      "#007acc",
      () => {
        if (S.state === STATES.IDLE || S.state === STATES.SELECTED) {
          startInspect();
        }
      }
    );

    const outlineItem = createFabMenuItem(
      "dom-outline-btn",
      "⬚",
      "Outline All",
      "#16a085",
      () => {
        if (!S.outlineMode) {
          startOutlineMode();
          document.getElementById("dom-outline-btn").innerHTML = "✕";
          document.getElementById("dom-outline-btn").parentElement.querySelector("span").textContent = "Exit Outline";
        } else {
          stopOutlineMode();
          document.getElementById("dom-outline-btn").innerHTML = "⬚";
          document.getElementById("dom-outline-btn").parentElement.querySelector("span").textContent = "Outline All";
        }
      }
    );

    const rulerItem = createFabMenuItem(
      "dom-ruler-btn",
      "📏",
      "Measure Distance",
      "#e67e22",
      () => {
        if (!S.rulerMode) {
          startRulerMode();
          document.getElementById("dom-ruler-btn").innerHTML = "✕";
          document.getElementById("dom-ruler-btn").parentElement.querySelector("span").textContent = "Exit Distance";
        } else {
          stopRulerMode();
          document.getElementById("dom-ruler-btn").innerHTML = "📏";
          document.getElementById("dom-ruler-btn").parentElement.querySelector("span").textContent = "Measure Distance";
        }
      }
    );

    const responsiveItem = createFabMenuItem(
      "dom-responsive-btn",
      "📱",
      "Responsive Mode",
      "#6f42c1",
      () => {
        if (!S.responsiveMode) {
          enterResponsiveMode();
          document.getElementById("dom-responsive-btn").innerHTML = "✕";
          document.getElementById("dom-responsive-btn").parentElement.querySelector("span").textContent = "Exit Responsive";
        } else {
          exitResponsiveMode();
          document.getElementById("dom-responsive-btn").innerHTML = "📱";
          document.getElementById("dom-responsive-btn").parentElement.querySelector("span").textContent = "Responsive Mode";
        }
      }
    );

    // Add items to menu in order
    fabMenu.appendChild(inspectItem);
    fabMenu.appendChild(outlineItem);
    fabMenu.appendChild(rulerItem);
    fabMenu.appendChild(responsiveItem);

    // Main FAB Button
    const mainFab = document.createElement("button");
    mainFab.id = "dom-inspector-main-fab";
    mainFab.innerHTML = "🛠️";
    Object.assign(mainFab.style, {
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "none",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "#fff",
      fontSize: "24px",
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      transition: "all 0.3s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    });

    let menuOpen = false;

    const toggleFabMenu = () => {
      menuOpen = !menuOpen;
      S.fabMenuOpen = menuOpen;

      if (menuOpen) {
        fabMenu.style.display = "flex";
        mainFab.style.transform = "rotate(45deg)";
        mainFab.innerHTML = "✕";

        // Animate menu items
        const items = fabMenu.querySelectorAll(".di-fab-menu-item");
        items.forEach((item, index) => {
          setTimeout(() => {
            item.style.opacity = "1";
            item.style.transform = "translateY(0)";
          }, index * 50);
        });
      } else {
        const items = fabMenu.querySelectorAll(".di-fab-menu-item");
        items.forEach((item, index) => {
          setTimeout(() => {
            item.style.opacity = "0";
            item.style.transform = "translateY(10px)";
          }, index * 30);
        });

        setTimeout(() => {
          fabMenu.style.display = "none";
          mainFab.style.transform = "rotate(0deg)";
          mainFab.innerHTML = "🛠️";
        }, items.length * 30 + 100);
      }
    };

    mainFab.onclick = (e) => {
      e.stopPropagation();
      toggleFabMenu();
    };

    mainFab.onmouseenter = () => {
      if (!menuOpen) {
        mainFab.style.transform = "scale(1.1)";
        mainFab.style.boxShadow = "0 6px 20px rgba(0,0,0,0.4)";
      }
    };

    mainFab.onmouseleave = () => {
      if (!menuOpen) {
        mainFab.style.transform = "scale(1)";
        mainFab.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)";
      }
    };

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (menuOpen && !fabContainer.contains(e.target)) {
        fabContainer.toggleMenu = toggleFabMenu;
      }
    });

    fabContainer.appendChild(fabMenu);
    fabContainer.appendChild(mainFab);
    document.body.appendChild(fabContainer);

    S.inspectBtn = fabContainer;
    S.toggleFabMenu = toggleFabMenu;

    // Hide initially
    fabContainer.style.display = "none";
  }


  function showInspectorButtons() {
    if (!S.buttonsVisible) {
      ensureInspectButton();
      if (S.inspectBtn) {
        S.inspectBtn.style.display = "block";
        S.buttonsVisible = true;
      }
    }
  }

  function hideInspectorButtons() {
    if (S.inspectBtn) {
      S.inspectBtn.style.display = "none";
      S.buttonsVisible = false;
    }
  }

  function createBreadcrumb(path, data) {
    const breadcrumb = document.createElement("div");
    breadcrumb.className = "di-breadcrumb";
    breadcrumb.style.cssText = `
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.8) 0%, rgba(20, 20, 20, 0.8) 100%);
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 10px;
  color: #999;
  overflow-x: auto;
  white-space: nowrap;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(79, 195, 247, 0.2);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  font-family: 'Courier New', monospace;
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
    // const breadcrumb = createBreadcrumb(data.path, data);
    // S.hoverPanel.appendChild(breadcrumb);

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
      font-size: 12px;
      line-height: 1.4;
      min-width: 200px
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

    // Update inspect button in FAB menu
    const inspectBtn = document.getElementById("dom-inspector-btn");
    if (inspectBtn) {
      inspectBtn.innerHTML = "⏸️";
      inspectBtn.parentElement.querySelector("span").textContent = "Inspecting... (Esc to exit)";
      inspectBtn.parentElement.querySelector("button").style.background = "#ff6600";
    }
    initializeResizeObserver();
    attachEventListeners();

    if (S.responsiveMode && S.viewportFrame?.iframe) {
      try {
        S.viewportFrame.iframe.contentWindow.postMessage({ type: 'INSPECTOR_START' }, '*');
      } catch (e) { }
    }
  }

  function stopInspect() {
    if (!isValidState()) return;

    setState(S.selectedItems.length > 0 ? STATES.SELECTED : STATES.IDLE);
    S.inspecting = false;
    document.body.style.cursor = "default";

    // Reset inspect button in FAB menu
    const inspectBtn = document.getElementById("dom-inspector-btn");
    if (inspectBtn) {
      inspectBtn.innerHTML = "🔍";
      inspectBtn.parentElement.querySelector("span").textContent = "Inspect Element";
      inspectBtn.parentElement.querySelector("button").style.background = "#007acc";
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


  // NEW RESPONSIVE DESIGN TESTING - PROPER IMPLEMENTATION
  function createViewportFrame() {
    if (S.viewportFrame) return;

    console.log('[DOM Inspector] Creating viewport frame...');

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
      padding: "60px 20px 60px 20px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      transition: "transform 0.3s ease"
    });

    // Iframe - LOAD ACTUAL URL
    const iframe = document.createElement("iframe");
    iframe.className = "di-viewport-iframe";
    Object.assign(iframe.style, {
      border: "none",
      background: "#fff",
      display: "block",
      borderRadius: "4px",
      width: S.currentViewport.width + "px",
      height: S.currentViewport.height + "px"
    });

    // Loading indicator
    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "di-loading-indicator";
    loadingIndicator.innerHTML = `
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #fff;
      font-family: system-ui, sans-serif;
      z-index: 1;
    ">
      <div style="
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255,255,255,0.1);
        border-top: 4px solid #007acc;
        border-radius: 50%;
        margin: 0 auto 20px;
        animation: spin 1s linear infinite;
      "></div>
      <div style="font-size: 14px;">Loading ${S.currentViewport.width}×${S.currentViewport.height} viewport...</div>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
    Object.assign(loadingIndicator.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "99991",
      pointerEvents: "none"
    });

    frameContainer.appendChild(iframe);
    frameContainer.appendChild(loadingIndicator);
    overlay.appendChild(frameContainer);

    // Enhanced Chrome DevTools-style Toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "di-viewport-toolbar";
    Object.assign(toolbar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      background: "rgba(30, 30, 30, 0.98)",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "12px",
      color: "#fff",
      backdropFilter: "blur(20px)",
      zIndex: 99992,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      userSelect: "none",
      height: "48px",
      boxSizing: "border-box"
    });

    // Current dimensions display
    const dimensionsDisplay = document.createElement("div");
    dimensionsDisplay.className = "di-toolbar-dimensions";
    dimensionsDisplay.style.cssText = "display: flex; align-items: center; gap: 8px; min-width: 150px;";
    dimensionsDisplay.innerHTML = `
    <span style="color: #999; font-size: 11px;">Dimensions:</span>
    <span id="di-frame-dimensions" style="font-weight: 600; color: #4fc3f7; font-family: monospace;">
      ${S.currentViewport.width} × ${S.currentViewport.height}
    </span>
  `;

    const separator1 = createSeparator();

    // Custom dimensions input
    const customDimensionsContainer = document.createElement("div");
    customDimensionsContainer.className = "di-toolbar-custom-inputs";
    customDimensionsContainer.style.cssText = "display: flex; align-items: center; gap: 6px;";

    const widthInput = createDimensionInput("di-custom-width", S.currentViewport.width, "W");
    const heightInput = createDimensionInput("di-custom-height", S.currentViewport.height, "H");

    const applyBtn = createToolbarButton("Apply", () => {
      const wInput = document.getElementById("di-custom-width");
      const hInput = document.getElementById("di-custom-height");

      if (wInput && hInput) {
        const w = parseInt(wInput.value);
        const h = parseInt(hInput.value);

        if (w >= 320 && h >= 240) {
          applyViewport({ name: 'Custom', width: w, height: h, type: 'custom' });
        }
      }
    });
    applyBtn.style.padding = "4px 10px";
    applyBtn.style.background = "#007acc";

    customDimensionsContainer.append(widthInput, heightInput, applyBtn);

    const separator2 = createSeparator();

    // Device presets dropdown
    const presetDropdown = createPresetDropdown();

    const separator3 = createSeparator();

    // Zoom controls
    const zoomContainer = document.createElement("div");
    zoomContainer.style.cssText = "display: flex; align-items: center; gap: 6px;";

    const zoomLabel = document.createElement("span");
    zoomLabel.style.cssText = "color: #999; font-size: 11px;";
    zoomLabel.textContent = "Zoom:";

    const zoomValue = document.createElement("span");
    zoomValue.id = "di-zoom-value";
    zoomValue.style.cssText = "color: #4fc3f7; min-width: 45px; text-align: center; font-family: monospace; font-size: 11px;";
    zoomValue.textContent = "100%";

    const zoomOut = createToolbarButton("−", () => adjustZoom(-0.1));
    const zoomIn = createToolbarButton("+", () => adjustZoom(0.1));
    const zoomReset = createToolbarButton("100%", () => setZoom(1));

    zoomContainer.append(zoomLabel, zoomOut, zoomValue, zoomIn, zoomReset);

    const separator4 = createSeparator();

    // Rotate button
    const rotateBtn = createToolbarButton("⟲", () => {
      const temp = S.currentViewport.width;
      applyViewport({
        ...S.currentViewport,
        width: S.currentViewport.height,
        height: temp
      });
    });
    rotateBtn.title = "Rotate viewport";

    const separator5 = createSeparator();

    // Reload button
    const reloadBtn = createToolbarButton("↻ Reload", () => {
      if (S.viewportFrame?.iframe) {
        S.viewportFrame.iframe.src = S.viewportFrame.iframe.src;
      }
    });
    reloadBtn.title = "Reload iframe content";

    // Spacer
    const spacer = document.createElement("div");
    spacer.style.flex = "1";

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.title = "Exit responsive mode";
    Object.assign(closeBtn.style, {
      background: "none",
      border: "none",
      color: "#fff",
      fontSize: "24px",
      cursor: "pointer",
      padding: "0",
      lineHeight: "1",
      width: "32px",
      height: "32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "4px",
      transition: "background 0.2s"
    });
    closeBtn.onmouseenter = () => closeBtn.style.background = "rgba(220, 53, 69, 0.2)";
    closeBtn.onmouseleave = () => closeBtn.style.background = "none";
    closeBtn.onclick = exitResponsiveMode;

    toolbar.append(
      dimensionsDisplay,
      separator1,
      customDimensionsContainer,
      separator2,
      presetDropdown,
      separator3,
      zoomContainer,
      separator4,
      rotateBtn,
      separator5,
      reloadBtn,
      spacer,
      closeBtn
    );

    document.body.appendChild(overlay);
    document.body.appendChild(toolbar);

    S.viewportFrame = {
      overlay: overlay,
      frameContainer: frameContainer,
      iframe: iframe,
      toolbar: toolbar,
      loadingIndicator: loadingIndicator,
      zoomLevel: 1
    };

    // Setup iframe load handler
    setupIframeLoad(iframe, loadingIndicator);

    // Load the current URL
    console.log('[DOM Inspector] Loading URL into iframe:', window.location.href);
    iframe.src = window.location.href;
  }

  function setupIframeLoad(iframe, loadingIndicator) {
    iframe.onload = () => {
      console.log('[DOM Inspector] Iframe loaded');

      // Hide loading indicator
      setTimeout(() => {
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }

        // Try to inject inspector into iframe
        try {
          injectInspectorIntoIframe(iframe);
        } catch (error) {
          console.warn('[DOM Inspector] Could not inject inspector into iframe:', error);
        }

      }, 300);
    };

    iframe.onerror = () => {
      console.error('[DOM Inspector] Iframe failed to load');
      if (loadingIndicator) {
        loadingIndicator.innerHTML = `
        <div style="text-align: center; color: #dc3545; font-family: system-ui, sans-serif; padding: 40px;">
          <h3 style="margin: 0 0 16px 0;">Failed to Load</h3>
          <p style="margin: 0 0 20px 0; color: #999;">Could not load page in responsive view.</p>
          <button onclick="window.parent.location.reload()" style="
            padding: 10px 20px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: system-ui, sans-serif;
          ">Reload Page</button>
        </div>
      `;
      }
    };
  }

  function injectInspectorIntoIframe(iframe) {
    try {
      const iframeDoc = iframe.contentDocument;
      const iframeWin = iframe.contentWindow;

      if (!iframeDoc || !iframeWin) {
        console.warn('[DOM Inspector] Cannot access iframe content (likely cross-origin)');
        return;
      }

      // Check if inspector is already injected
      if (iframeWin.__DOM_INSPECTOR_CHILD__) {
        console.log('[DOM Inspector] Already injected into iframe');
        return;
      }

      iframeWin.__DOM_INSPECTOR_CHILD__ = true;

      console.log('[DOM Inspector] Injecting inspector into iframe...');

      // Add message listener in iframe to communicate with parent
      iframeWin.addEventListener('message', (event) => {
        if (event.data.type === 'INSPECTOR_START') {
          // Parent wants to start inspecting
          iframeDoc.body.style.cursor = 'crosshair';
        } else if (event.data.type === 'INSPECTOR_STOP') {
          iframeDoc.body.style.cursor = 'default';
        }
      });

      // Send hover data to parent on mousemove
      iframeDoc.addEventListener('mousemove', (e) => {
        if (!S.inspecting) return;

        const target = e.target;
        if (isInspectorElement(target)) return;

        const data = getDataFromIframeElement(target, iframe);
        if (data) {
          // Update parent's hover panel
          if (S.hoverPanel) {
            S.hoverPanel.style.display = 'block';
            updateHoverPanel(data);
            positionHoverPanelFixed(data);
          }
          updateIframeBoxModelLayers(data);
        }
      });

      // Handle clicks in iframe
      iframeDoc.addEventListener('click', (e) => {
        if (!S.inspecting) return;

        const target = e.target;
        if (isInspectorElement(target)) return;

        e.preventDefault();
        e.stopPropagation();

        const data = getDataFromIframeElement(target, iframe);
        if (data) {
          addSelected(data);
          stopInspect();
        }
      }, true);

      console.log('[DOM Inspector] Inspector injected successfully');

    } catch (error) {
      console.error('[DOM Inspector] Failed to inject inspector:', error);
    }
  }

  function getDataFromIframeElement(el, iframe) {
    try {
      const iframeDoc = iframe.contentDocument;
      const cs = iframeDoc.defaultView.getComputedStyle(el);
      const r = el.getBoundingClientRect();

      // Map coordinates from iframe to parent
      const iframeRect = iframe.getBoundingClientRect();
      const zoom = S.viewportFrame?.zoomLevel || 1;

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
    } catch (error) {
      console.error('[DOM Inspector] Error getting iframe element data:', error);
      return null;
    }
  }

  function positionHoverPanelFixed(data) {
    if (!S.hoverPanel) return;

    const r = data.rect;
    const panelRect = S.hoverPanel.getBoundingClientRect();
    const OFFSET = 10;

    S.hoverPanel.style.position = "fixed";

    let top = r.top - panelRect.height - OFFSET;
    let left = r.left;

    // Keep panel in viewport
    if (top < 60) { // Below toolbar
      top = r.bottom + OFFSET;
    }

    if (left + panelRect.width > window.innerWidth - 20) {
      left = window.innerWidth - panelRect.width - 20;
    }

    if (left < 20) left = 20;

    S.hoverPanel.style.top = top + "px";
    S.hoverPanel.style.left = left + "px";
  }

  function applyViewport(preset) {
    if (!S.responsiveMode || !S.viewportFrame) return;

    console.log('[DOM Inspector] Applying viewport:', preset);

    S.currentViewport = { ...preset };

    const iframe = S.viewportFrame.iframe;
    const loadingIndicator = S.viewportFrame.loadingIndicator;

    // Show loading
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
      loadingIndicator.querySelector('div div:last-child').textContent =
        `Loading ${preset.width}×${preset.height} viewport...`;
    }

    // Resize iframe
    iframe.style.width = preset.width + "px";
    iframe.style.height = preset.height + "px";

    // Update UI
    updateViewportDisplays(preset);

    // Auto-fit zoom
    autoFitZoom(preset);

    // Reload iframe to apply new dimensions
    setTimeout(() => {
      iframe.src = iframe.src;
    }, 100);
  }

  function enterResponsiveMode() {
    if (S.responsiveMode) return;

    console.log('[DOM Inspector] Entering responsive mode...');

    S.responsiveMode = true;
    setState(STATES.SELECTED);

    // Store original body overflow
    S.originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Set initial viewport
    S.currentViewport = {
      name: 'Current',
      width: Math.min(window.innerWidth - 100, 1920),
      height: Math.min(window.innerHeight - 100, 1080),
      type: 'desktop'
    };

    createViewportFrame();

    console.log('[DOM Inspector] Responsive mode activated');
  }

  function exitResponsiveMode() {
    if (!S.responsiveMode) return;

    console.log('[DOM Inspector] Exiting responsive mode...');

    S.responsiveMode = false;

    // Restore body overflow
    if (S.originalBodyOverflow !== undefined) {
      document.body.style.overflow = S.originalBodyOverflow;
      S.originalBodyOverflow = undefined;
    }

    // Remove viewport frame
    if (S.viewportFrame) {
      remove(S.viewportFrame.overlay);
      remove(S.viewportFrame.toolbar);
      S.viewportFrame = null;
    }

    setState(STATES.IDLE);

    console.log('[DOM Inspector] Responsive mode deactivated');
  }


  // Helper: Create dimension input
  function createDimensionInput(id, value, label) {
    const container = document.createElement("div");
    container.style.cssText = "display: flex; align-items: center; gap: 4px;";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    labelSpan.style.cssText = "color: #999; font-size: 11px; font-weight: 500;";

    const input = document.createElement("input");
    input.type = "number";
    input.id = id;
    input.value = value;
    input.min = "320";
    input.max = "7680";
    Object.assign(input.style, {
      width: "60px",
      padding: "4px 6px",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "3px",
      color: "#fff",
      fontSize: "11px",
      fontFamily: "monospace",
      textAlign: "center"
    });
    input.onfocus = () => input.style.borderColor = "#007acc";
    input.onblur = () => input.style.borderColor = "rgba(255,255,255,0.2)";

    container.append(labelSpan, input);
    return container;
  }

  // Helper: Create separator
  function createSeparator() {
    const sep = document.createElement("div");
    sep.className = "di-toolbar-separator";
    sep.style.cssText = "width: 1px; height: 24px; background: rgba(255,255,255,0.1);";
    return sep;
  }

  // Helper: Create preset dropdown
  function createPresetDropdown() {
    const container = document.createElement("div");
    container.className = "di-toolbar-presets";
    container.style.cssText = "position: relative;";

    const select = document.createElement("select");
    select.id = "di-preset-select";
    Object.assign(select.style, {
      padding: "4px 24px 4px 8px",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "3px",
      color: "#fff",
      fontSize: "11px",
      cursor: "pointer",
      appearance: "none",
      minWidth: "180px",
      backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27%3e%3cpath fill=%27%23999%27 d=%27M0 0l6 8 6-8z%27/%3e%3c/svg%3e')",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 8px center"
    });

    select.onfocus = () => select.style.borderColor = "#007acc";
    select.onblur = () => select.style.borderColor = "rgba(255,255,255,0.2)";

    // Add option groups
    const currentOption = document.createElement("option");
    currentOption.value = "current";
    currentOption.textContent = `Current (${S.currentViewport.width}×${S.currentViewport.height})`;
    select.appendChild(currentOption);

    const groupedPresets = {
      mobile: viewportPresets.filter(p => p.type === 'mobile'),
      tablet: viewportPresets.filter(p => p.type === 'tablet'),
      desktop: viewportPresets.filter(p => p.type === 'desktop')
    };

    Object.entries(groupedPresets).forEach(([type, presets]) => {
      if (presets.length === 0) return;

      const optgroup = document.createElement("optgroup");
      optgroup.label = type.charAt(0).toUpperCase() + type.slice(1);

      presets.forEach(preset => {
        const option = document.createElement("option");
        option.value = JSON.stringify(preset);
        option.textContent = `${preset.name} (${preset.width}×${preset.height})`;
        optgroup.appendChild(option);
      });

      select.appendChild(optgroup);
    });

    select.onchange = () => {
      if (select.value === "current") return;

      const preset = JSON.parse(select.value);
      applyViewport(preset);

      // Update custom inputs
      const widthInput = document.getElementById("di-custom-width");
      const heightInput = document.getElementById("di-custom-height");
      if (widthInput) widthInput.value = preset.width;
      if (heightInput) heightInput.value = preset.height;
    };

    container.appendChild(select);
    return container;
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

    try {
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
    } catch (error) {
      console.warn('[DOM Inspector] Could not apply viewport to iframe:', error);
    }
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
    const dimensionsLabel = document.getElementById("di-frame-dimensions");

    if (dimensionsLabel) {
      dimensionsLabel.textContent = `${preset.width} × ${preset.height}`;
    }

    // Update custom inputs
    const widthInput = document.getElementById("di-custom-width");
    const heightInput = document.getElementById("di-custom-height");
    if (widthInput && widthInput.parentElement) widthInput.parentElement.querySelector('input').value = preset.width;
    if (heightInput && heightInput.parentElement) heightInput.parentElement.querySelector('input').value = preset.height;

    // Update dropdown
    const presetSelect = document.getElementById("di-preset-select");
    if (presetSelect) {
      // Try to find matching preset
      const matchingPreset = viewportPresets.find(p => p.width === preset.width && p.height === preset.height);
      if (matchingPreset) {
        presetSelect.value = JSON.stringify(matchingPreset);
      } else {
        presetSelect.value = "current";
        // Update current option text
        const currentOption = presetSelect.querySelector('option[value="current"]');
        if (currentOption) {
          currentOption.textContent = `${preset.name} (${preset.width}×${preset.height})`;
        }
      }
    }
  }


  function getDataFromIframeElement(el) {
    const iframe = S.viewportFrame?.iframe;
    if (!iframe) return null;

    try {
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc || !iframeDoc.defaultView) {
        console.warn('[DOM Inspector] Cannot access iframe document');
        // return null;
      }
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
    } catch (error) {
      console.error('[DOM Inspector] Error getting iframe element data:', error);
      return null;
    }
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

  function enterResponsiveMode() {
    if (S.responsiveMode) {
      console.log('[DOM Inspector] Already in responsive mode');
      return;
    }

    console.log('[DOM Inspector] Entering responsive mode...');

    S.responsiveMode = true;
    setState(STATES.SELECTED);

    createViewportFrame();

    // Store original body overflow
    S.originalBodyOverflow = document.body.style.overflow;
    // Hide parent body scrollbars to prevent double scrolling
    document.body.style.overflow = 'hidden';

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
    // Restore original body overflow
    if (S.originalBodyOverflow !== undefined) {
      document.body.style.overflow = S.originalBodyOverflow;
      S.originalBodyOverflow = undefined;
    }
    // Remove UI elements
    // if (S.responsivePanel) {
    //   remove(S.responsivePanel);
    //   S.responsivePanel = null;
    // }
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
    // Detect pseudo-state styles for this element
    const pseudoStates = getPseudoStateStyles(data.el);

    // Check if element has any pseudo-state styles
    const hasAnyPseudoStates = Object.values(pseudoStates).some(state => state && state.length > 0);

    // Don't show panel if no pseudo-states exist
    if (!hasAnyPseudoStates) {
      return null;
    }

    const container = document.createElement("div");
    container.className = "di-pseudo-state-panel";
    container.style.cssText = `
    background: linear-gradient(135deg, rgba(45, 45, 45, 0.95) 0%, rgba(35, 35, 35, 0.95) 100%);
    padding: 10px;
    margin: 10px 0;
    border-radius: 6px;
    border: 1px solid rgba(76, 175, 80, 0.3);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
  `;

    const header = document.createElement("div");
    header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  `;

    const icon = document.createElement("span");
    icon.textContent = "🎨";
    icon.style.fontSize = "14px";

    const title = document.createElement("div");
    title.textContent = "Pseudo States";
    title.style.cssText = `
    font-size: 11px;
    color: #4caf50;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `;

    header.appendChild(icon);
    header.appendChild(title);
    container.appendChild(header);

    const states = ['hover', 'focus', 'active', 'focus-visible'];

    states.forEach(state => {
      const stateData = pseudoStates[state];
      if (!stateData || stateData.length === 0) return; // Skip if no styles for this state

      const stateContainer = document.createElement("div");
      stateContainer.className = `di-pseudo-${state}-container`;
      stateContainer.style.cssText = `
      margin-bottom: 8px;
      border-left: 3px solid ${getStateColor(state)};
      padding-left: 8px;
    `;

      const stateHeader = document.createElement("div");
      stateHeader.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    `;

      const stateLabel = document.createElement("span");
      stateLabel.textContent = `:${state}`;
      stateLabel.style.cssText = `
      font-size: 11px;
      color: ${getStateColor(state)};
      font-weight: 600;
      font-family: monospace;
    `;

      const toggleBtn = document.createElement("button");
      toggleBtn.textContent = "Force";
      toggleBtn.className = `di-pseudo-btn di-pseudo-${state}`;
      Object.assign(toggleBtn.style, {
        padding: "3px 8px",
        border: `1px solid ${getStateColor(state)}`,
        background: "rgba(255, 255, 255, 0.05)",
        color: getStateColor(state),
        borderRadius: "3px",
        cursor: "pointer",
        fontSize: "10px",
        fontWeight: "500",
        transition: "all 0.2s",
        fontFamily: "system-ui, sans-serif"
      });

      let isActive = false;
      const styleId = `di-pseudo-force-${state}-${Date.now()}`;

      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        isActive = !isActive;

        if (isActive) {
          toggleBtn.textContent = "✓ Active";
          toggleBtn.style.background = getStateColor(state);
          toggleBtn.style.color = "#fff";
          toggleBtn.style.fontWeight = "600";

          // Apply actual pseudo-state styles
          const uniqueClass = `di-force-${state}-${Date.now()}`;
          data.el.classList.add(uniqueClass);

          let style = document.getElementById(styleId);
          if (!style) {
            style = document.createElement("style");
            style.id = styleId;
            document.head.appendChild(style);
          }

          // Build CSS from detected pseudo-state rules
          let cssRules = '';
          stateData.forEach(rule => {
            const properties = Object.entries(rule.properties)
              .map(([prop, value]) => `  ${prop}: ${value} !important;`)
              .join('\n');

            cssRules += `.${uniqueClass} {\n${properties}\n}\n`;
          });

          style.textContent = cssRules;

        } else {
          toggleBtn.textContent = "Force";
          toggleBtn.style.background = "rgba(255, 255, 255, 0.05)";
          toggleBtn.style.color = getStateColor(state);
          toggleBtn.style.fontWeight = "500";

          // Remove forced styles
          const style = document.getElementById(styleId);
          if (style) {
            document.head.removeChild(style);
          }

          // Remove all classes that start with di-force-{state}
          const classesToRemove = Array.from(data.el.classList)
            .filter(c => c.startsWith(`di-force-${state}`));
          classesToRemove.forEach(c => data.el.classList.remove(c));
        }
      };

      stateHeader.appendChild(stateLabel);
      stateHeader.appendChild(toggleBtn);
      stateContainer.appendChild(stateHeader);

      // Show CSS properties for this pseudo-state
      const cssDisplay = document.createElement("div");
      cssDisplay.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      padding: 6px 8px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 10px;
      line-height: 1.4;
      color: #b5cea8;
      max-height: 120px;
      overflow-y: auto;
    `;

      // Combine all properties from all matching rules
      const allProperties = {};
      stateData.forEach(rule => {
        Object.entries(rule.properties).forEach(([prop, value]) => {
          allProperties[prop] = value; // Later rules override
        });
      });

      const propertiesText = Object.entries(allProperties)
        .map(([prop, value]) => `<span style="color: #9cdcfe;">${prop}</span>: <span style="color: #ce9178;">${value}</span>;`)
        .join('<br>');

      cssDisplay.innerHTML = `:${state} {<br>${propertiesText}<br>}`;
      stateContainer.appendChild(cssDisplay);

      container.appendChild(stateContainer);
    });

    return container;
  }

  // Helper function for state colors
  function getStateColor(state) {
    const colors = {
      'hover': '#ff9800',
      'focus': '#2196f3',
      'active': '#f44336',
      'focus-visible': '#9c27b0'
    };
    return colors[state] || '#4caf50';
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

    // const item = document.createElement("div");
    // item.className = "di-panel-item";
    // item.style.borderBottom = "1px solid #444";
    // item.style.marginBottom = "8px";
    // item.style.paddingBottom = "8px";

    // // Breadcrumb
    // const breadcrumb = createBreadcrumb(data.path, data);
    // item.appendChild(breadcrumb);

    // const header = document.createElement("div");
    // header.innerHTML = `<b>${data.selector}</b><div style="color: #999; margin-top: 2px;">${data.width} × ${data.height}</div>`;

    // // Pseudo-state controls
    // const pseudoControls = createPseudoStateToggle(data);

    // const cssPreview = document.createElement("pre");
    // cssPreview.className = "di-css-preview";
    // cssPreview.style.cssText = `
    //   background: #2d2d2d;
    //   padding: 8px;
    //   margin: 8px 0;
    //   border-radius: 4px;
    //   font-size: 12px;
    //   overflow-x: auto;
    //   max-height: 200px;
    //   overflow-y: auto;
    //   font-family: 'Courier New', monospace;
    //   line-height: 1.4;
    // `;
    // cssPreview.textContent = cssText(data);

    const item = document.createElement("div");
    item.className = "di-panel-item";
    item.style.cssText = `
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 12px;
  padding-bottom: 12px;
  background: linear-gradient(135deg, rgba(40, 40, 40, 0.4) 0%, rgba(30, 30, 30, 0.4) 100%);
  border-radius: 6px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
`;

    // Add hover effect
    item.onmouseenter = () => {
      item.style.background = "linear-gradient(135deg, rgba(45, 45, 45, 0.6) 0%, rgba(35, 35, 35, 0.6) 100%)";
      item.style.borderColor = "rgba(79, 195, 247, 0.3)";
      item.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    };
    item.onmouseleave = () => {
      item.style.background = "linear-gradient(135deg, rgba(40, 40, 40, 0.4) 0%, rgba(30, 30, 30, 0.4) 100%)";
      item.style.borderColor = "rgba(255, 255, 255, 0.05)";
      item.style.boxShadow = "none";
    };

    // Breadcrumb (improved styling in createBreadcrumb)
    const breadcrumb = createBreadcrumb(data.path, data);
    item.appendChild(breadcrumb);

    // Header with better styling
    const header = document.createElement("div");
    header.style.cssText = `
  margin: 8px 0;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  border-left: 3px solid #4fc3f7;
`;
    header.innerHTML = `
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
    <b style="color: #4fc3f7; font-size: 13px;">${data.selector}</b>
    <span style="
      background: rgba(76, 175, 80, 0.2);
      color: #4caf50;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      border: 1px solid rgba(76, 175, 80, 0.3);
    ">${data.display}</span>
  </div>
  <div style="color: #999; font-size: 11px; font-family: monospace;">
    📐 ${data.width} × ${data.height}
  </div>
`;
    item.appendChild(header);

    // Pseudo-state controls (now only shows if element has pseudo-states)
    const pseudoControls = createPseudoStateToggle(data);
    if (pseudoControls) {
      item.appendChild(pseudoControls);
    }

    // Improved CSS Preview with collapsible section
    const cssSection = document.createElement("div");
    cssSection.style.cssText = "margin: 8px 0;";

    const cssHeader = document.createElement("div");
    cssHeader.style.cssText = `
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  user-select: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: none;
`;

    const cssHeaderTitle = document.createElement("span");
    cssHeaderTitle.style.cssText = `
  font-size: 11px;
  color: #9cdcfe;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
`;
    cssHeaderTitle.innerHTML = `<span style="font-size: 14px;">{ }</span> CSS Properties`;

    const cssToggleIcon = document.createElement("span");
    cssToggleIcon.textContent = "▼";
    cssToggleIcon.style.cssText = `
  font-size: 10px;
  color: #666;
  transition: transform 0.2s;
`;

    cssHeader.appendChild(cssHeaderTitle);
    cssHeader.appendChild(cssToggleIcon);

    const cssPreview = document.createElement("pre");
    cssPreview.className = "di-css-preview";
    cssPreview.style.cssText = `
  background: rgba(0, 0, 0, 0.4);
  padding: 10px;
  margin: 0;
  border-radius: 0 0 4px 4px;
  font-size: 10px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  line-height: 1.6;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: none;
  color: #d4d4d4;
`;
    cssPreview.textContent = cssText(data);

    // Toggle collapse
    let isCollapsed = false;
    cssHeader.onclick = (e) => {
      e.stopPropagation();
      isCollapsed = !isCollapsed;

      if (isCollapsed) {
        cssPreview.style.display = "none";
        cssToggleIcon.style.transform = "rotate(-90deg)";
        cssHeader.style.borderRadius = "4px";
        cssHeader.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
      } else {
        cssPreview.style.display = "block";
        cssToggleIcon.style.transform = "rotate(0deg)";
        cssHeader.style.borderRadius = "4px 4px 0 0";
        cssHeader.style.borderBottom = "none";
      }
    };

    cssSection.appendChild(cssHeader);
    cssSection.appendChild(cssPreview);
    item.appendChild(cssSection);

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
      padding: "8px 14px",
      border: "none",
      borderRadius: "5px",
      cursor: "pointer",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "11px",
      fontWeight: "600",
      transition: "all 0.2s",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
      textTransform: "uppercase",
      letterSpacing: "0.5px"
    }));

    copyBtn.style.background = "linear-gradient(135deg, #007acc 0%, #005a9e 100%)";
    copyBtn.style.color = "#fff";
    copyBtn.style.border = "1px solid rgba(255, 255, 255, 0.1)";

    clearBtn.style.background = "linear-gradient(135deg, #dc3545 0%, #bd2130 100%)";
    clearBtn.style.color = "#fff";
    clearBtn.style.border = "1px solid rgba(255, 255, 255, 0.1)";

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

  /*  RULER / DISTANCE MEASUREMENT  */
  function startRulerMode() {
    if (S.rulerMode) return;

    console.log('[DOM Inspector] Starting ruler mode...');

    S.rulerMode = true;
    S.firstSelectedElement = null;
    document.body.style.cursor = "crosshair";

    // Disable other FAB buttons during ruler mode
    const fabButtons = ["dom-inspector-btn", "dom-responsive-btn"];
    fabButtons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.style.opacity = "0.5";
        btn.style.pointerEvents = "none";
      }
    });

    // Attach ruler-specific event listeners
    attachRulerListeners();
  }

  function stopRulerMode() {
    if (!S.rulerMode) return;

    console.log('[DOM Inspector] Stopping ruler mode...');

    S.rulerMode = false;
    S.firstSelectedElement = null;
    document.body.style.cursor = "default";

    // Re-enable other FAB buttons
    const fabButtons = ["dom-inspector-btn", "dom-responsive-btn"];
    fabButtons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
      }
    });
    // Also update ruler button
    const rulerBtn = document.getElementById("dom-ruler-btn");
    if (rulerBtn) {
      rulerBtn.textContent = "📏 Distance";
      rulerBtn.style.background = "#e67e22";
    }

    // Clear all ruler visuals
    clearRulerVisuals();

    // Detach ruler listeners
    detachRulerListeners();
  }
  /*  OUTLINE MODE  */

  function startOutlineMode() {
    if (S.outlineMode) return;

    console.log('[DOM Inspector] Starting outline mode...');

    S.outlineMode = true;

    // Create and inject CSS
    const style = document.createElement("style");
    style.id = "di-outline-mode-style";
    style.textContent = `
      /* Outline all elements */
      body * {
        outline: 1px solid rgba(255, 0, 0, 0.3) !important;
        outline-offset: -1px !important;
      }

      /* Different colors for different element types */
      div {
        outline-color: rgba(255, 0, 0, 0.4) !important;
      }

      section, article, aside, nav, header, footer, main {
        outline-color: rgba(0, 150, 255, 0.5) !important;
        outline-width: 2px !important;
      }

      p, span, a, strong, em, h1, h2, h3, h4, h5, h6 {
        outline-color: rgba(0, 200, 0, 0.4) !important;
      }

      img, video, canvas, svg {
        outline-color: rgba(255, 150, 0, 0.6) !important;
        outline-width: 2px !important;
      }

      ul, ol, li {
        outline-color: rgba(150, 0, 255, 0.4) !important;
      }

      input, textarea, select, button, form {
        outline-color: rgba(255, 200, 0, 0.5) !important;
        outline-width: 2px !important;
      }

      table, tr, td, th {
        outline-color: rgba(0, 255, 255, 0.4) !important;
      }

      /* Exclude inspector elements */
      .di-inspect-btn,
      .di-responsive-btn,
      .di-ruler-btn,
      .di-outline-btn,
      .di-hover-panel,
      .di-selected-panel,
      .di-selected-overlay,
      .di-panel-item,
      .di-button,
      .di-box-layer,
      .di-panel-header,
      .di-collapse-btn,
      .di-grid-overlay,
      .di-flex-overlay,
      .di-breadcrumb,
      .di-ruler-highlight,
      .di-ruler-selected,
      .di-ruler-target,
      .di-ruler-line,
      .di-ruler-arrow,
      .di-distance-label,
      .di-viewport-overlay,
      .di-frame-container,
      .di-viewport-iframe,
      .di-viewport-toolbar,
      .di-loading-indicator {
        outline: none !important;
      }

      /* Add legend for color coding */
      body::before {
        content: "OUTLINE MODE ACTIVE | 🔴 Divs | 🔵 Semantic | 🟢 Text | 🟠 Media | 🟣 Lists | 🟡 Forms | 🔵 Tables";
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        padding: 8px 16px;
        border-radius: 6px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 11px;
        font-weight: 500;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        pointer-events: none;
      }
    `;

    document.head.appendChild(style);
    S.outlineStyleElement = style;

    console.log('[DOM Inspector] Outline mode activated - all elements outlined');
  }

  function stopOutlineMode() {
    if (!S.outlineMode) return;

    console.log('[DOM Inspector] Stopping outline mode...');

    S.outlineMode = false;

    // Remove the style element
    if (S.outlineStyleElement) {
      remove(S.outlineStyleElement);
      S.outlineStyleElement = null;
    }

    console.log('[DOM Inspector] Outline mode deactivated');
  }

  function attachRulerListeners() {
    const handleRulerMouseMove = (e) => {
      if (!S.rulerMode) return;
      if (isInspectorElement(e.target)) return;

      const hoveredElement = e.target;

      if (S.firstSelectedElement) {
        // If reference is set, show distance to hovered element
        if (hoveredElement !== S.firstSelectedElement) {
          showDistanceMeasurements(S.firstSelectedElement, hoveredElement);
        }
      } else {
        // No reference set - just highlight hovered element
        highlightElementForRuler(hoveredElement);
      }
    };

    const handleRulerClick = (e) => {
      if (!S.rulerMode) return;
      if (isInspectorElement(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      const clickedElement = e.target;

      if (!S.firstSelectedElement) {
        // First click - set as reference element
        S.firstSelectedElement = clickedElement;
        highlightSelectedElement(clickedElement);
        console.log('[DOM Inspector] Reference element selected');
      } else if (clickedElement === S.firstSelectedElement) {
        // Clicked same element - deselect reference
        S.firstSelectedElement = null;
        clearRulerVisuals();
        console.log('[DOM Inspector] Reference element cleared');
      } else {
        // Clicked different element - replace reference
        S.firstSelectedElement = clickedElement;
        clearRulerVisuals();
        highlightSelectedElement(clickedElement);
        console.log('[DOM Inspector] Reference element changed');
      }
    };

    const handleRulerKeyDown = (e) => {
      if (!S.rulerMode) return;

      if (e.key === "Escape") {
        e.preventDefault();
        stopRulerMode();
        // Also update button
        const rulerBtn = document.getElementById("dom-ruler-btn");
        if (rulerBtn) {
          rulerBtn.textContent = "📏 Distance";
          rulerBtn.style.background = "#e67e22";
        }
      }
    };

    document.addEventListener("mousemove", handleRulerMouseMove);
    document.addEventListener("click", handleRulerClick, true);
    document.addEventListener("keydown", handleRulerKeyDown);

    S.handlers.rulerMouseMove = handleRulerMouseMove;
    S.handlers.rulerClick = handleRulerClick;
    S.handlers.rulerKeyDown = handleRulerKeyDown;
  }

  function detachRulerListeners() {
    if (S.handlers.rulerMouseMove) {
      document.removeEventListener("mousemove", S.handlers.rulerMouseMove);
      S.handlers.rulerMouseMove = null;
    }
    if (S.handlers.rulerClick) {
      document.removeEventListener("click", S.handlers.rulerClick, true);
      S.handlers.rulerClick = null;
    }
    if (S.handlers.rulerKeyDown) {
      document.removeEventListener("keydown", S.handlers.rulerKeyDown);
      S.handlers.rulerKeyDown = null;
    }
  }

  function highlightElementForRuler(element) {
    clearRulerVisuals();

    const rect = element.getBoundingClientRect();

    const highlight = document.createElement("div");
    highlight.className = "di-ruler-highlight";
    Object.assign(highlight.style, {
      position: "absolute",
      top: (rect.top + window.scrollY) + "px",
      left: (rect.left + window.scrollX) + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      border: "2px solid #e67e22",
      background: "rgba(230, 126, 34, 0.1)",
      pointerEvents: "none",
      zIndex: 99995,
      boxSizing: "border-box"
    });

    document.body.appendChild(highlight);
    S.rulerLines.push(highlight);
  }

  function highlightSelectedElement(element) {
    clearRulerVisuals();

    const rect = element.getBoundingClientRect();

    const highlight = document.createElement("div");
    highlight.className = "di-ruler-selected";
    Object.assign(highlight.style, {
      position: "absolute",
      top: (rect.top + window.scrollY) + "px",
      left: (rect.left + window.scrollX) + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      border: "3px solid #3498db",
      background: "rgba(52, 152, 219, 0.15)",
      pointerEvents: "none",
      zIndex: 99996,
      boxSizing: "border-box",
      boxShadow: "0 0 0 2px rgba(52, 152, 219, 0.3)"
    });

    document.body.appendChild(highlight);
    S.rulerLines.push(highlight);

    // Add label
    const label = document.createElement("div");
    label.className = "di-ruler-label";
    label.textContent = "Reference Element (Click to change or deselect)";
    Object.assign(label.style, {
      position: "absolute",
      top: (rect.top + window.scrollY - 30) + "px",
      left: (rect.left + window.scrollX) + "px",
      background: "rgba(52, 152, 219, 0.95)",
      color: "#fff",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "11px",
      fontFamily: "system-ui, sans-serif",
      fontWeight: "500",
      pointerEvents: "none",
      zIndex: 99997,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
    });

    document.body.appendChild(label);
    S.measurementLabels.push(label);
  }

  function showDistanceMeasurements(element1, element2) {
    clearRulerVisuals();

    // Keep reference element highlighted
    highlightSelectedElement(element1);

    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();

    // Highlight target element
    const highlight2 = document.createElement("div");
    highlight2.className = "di-ruler-target";
    Object.assign(highlight2.style, {
      position: "absolute",
      top: (rect2.top + window.scrollY) + "px",
      left: (rect2.left + window.scrollX) + "px",
      width: rect2.width + "px",
      height: rect2.height + "px",
      border: "2px solid #e67e22",
      background: "rgba(230, 126, 34, 0.1)",
      pointerEvents: "none",
      zIndex: 99995,
      boxSizing: "border-box"
    });
    document.body.appendChild(highlight2);
    S.rulerLines.push(highlight2);

    // Calculate distances
    const distances = calculateDistances(rect1, rect2);

    // Draw horizontal distance (X-axis)
    if (distances.horizontal > 0) {
      drawHorizontalDistance(rect1, rect2, distances.horizontal);
    }

    // Draw vertical distance (Y-axis)
    if (distances.vertical > 0) {
      drawVerticalDistance(rect1, rect2, distances.vertical);
    }

    // If overlapping, show that information
    if (distances.overlapX && distances.overlapY) {
      showOverlapIndicator(rect1, rect2);
    }
  }

  function drawHorizontalDistance(rect1, rect2, distance) {
    let x1, x2, y;

    // Determine which element is on the left
    if (rect1.right <= rect2.left) {
      // rect2 is to the right of rect1
      x1 = rect1.right + window.scrollX;
      x2 = rect2.left + window.scrollX;

      // Calculate Y position - use the overlapping vertical range or midpoint
      const overlapTop = Math.max(rect1.top, rect2.top);
      const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

      if (overlapTop < overlapBottom) {
        // There is vertical overlap - use middle of overlap
        y = ((overlapTop + overlapBottom) / 2) + window.scrollY;
      } else {
        // No vertical overlap - use midpoint between elements
        y = ((rect1.top + rect1.bottom + rect2.top + rect2.bottom) / 4) + window.scrollY;
      }
    } else if (rect2.right <= rect1.left) {
      // rect2 is to the left of rect1
      x1 = rect2.right + window.scrollX;
      x2 = rect1.left + window.scrollX;

      const overlapTop = Math.max(rect1.top, rect2.top);
      const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

      if (overlapTop < overlapBottom) {
        y = ((overlapTop + overlapBottom) / 2) + window.scrollY;
      } else {
        y = ((rect1.top + rect1.bottom + rect2.top + rect2.bottom) / 4) + window.scrollY;
      }
    } else {
      // Horizontally overlapping - don't draw
      return;
    }

    // Draw horizontal line
    const line = document.createElement("div");
    line.className = "di-ruler-line";
    Object.assign(line.style, {
      position: "absolute",
      top: y + "px",
      left: x1 + "px",
      width: (x2 - x1) + "px",
      height: "2px",
      background: "#e74c3c",
      pointerEvents: "none",
      zIndex: 99994
    });
    document.body.appendChild(line);
    S.rulerLines.push(line);

    // Draw arrows at ends
    const arrow1 = createArrow(x1, y, 'left');
    const arrow2 = createArrow(x2, y, 'right');
    document.body.appendChild(arrow1);
    document.body.appendChild(arrow2);
    S.rulerLines.push(arrow1, arrow2);

    // Draw label
    const label = createDistanceLabel(
      `${distance}px`,
      (x1 + x2) / 2,
      y,
      '#e74c3c'
    );
    document.body.appendChild(label);
    S.measurementLabels.push(label);
  }
  function drawVerticalDistance(rect1, rect2, distance) {
    let y1, y2, x;

    // Determine which element is above
    if (rect1.bottom <= rect2.top) {
      // rect2 is below rect1
      y1 = rect1.bottom + window.scrollY;
      y2 = rect2.top + window.scrollY;

      // Calculate X position - use the overlapping horizontal range or midpoint
      const overlapLeft = Math.max(rect1.left, rect2.left);
      const overlapRight = Math.min(rect1.right, rect2.right);

      if (overlapLeft < overlapRight) {
        // There is horizontal overlap - use middle of overlap
        x = ((overlapLeft + overlapRight) / 2) + window.scrollX;
      } else {
        // No horizontal overlap - use midpoint between elements
        x = ((rect1.left + rect1.right + rect2.left + rect2.right) / 4) + window.scrollX;
      }
    } else if (rect2.bottom <= rect1.top) {
      // rect2 is above rect1
      y1 = rect2.bottom + window.scrollY;
      y2 = rect1.top + window.scrollY;

      const overlapLeft = Math.max(rect1.left, rect2.left);
      const overlapRight = Math.min(rect1.right, rect2.right);

      if (overlapLeft < overlapRight) {
        x = ((overlapLeft + overlapRight) / 2) + window.scrollX;
      } else {
        x = ((rect1.left + rect1.right + rect2.left + rect2.right) / 4) + window.scrollX;
      }
    } else {
      // Vertically overlapping - don't draw
      return;
    }

    // Draw vertical line
    const line = document.createElement("div");
    line.className = "di-ruler-line";
    Object.assign(line.style, {
      position: "absolute",
      top: y1 + "px",
      left: x + "px",
      width: "2px",
      height: (y2 - y1) + "px",
      background: "#9b59b6",
      pointerEvents: "none",
      zIndex: 99994
    });
    document.body.appendChild(line);
    S.rulerLines.push(line);

    // Draw arrows at ends
    const arrow1 = createArrow(x, y1, 'up');
    const arrow2 = createArrow(x, y2, 'down');
    document.body.appendChild(arrow1);
    document.body.appendChild(arrow2);
    S.rulerLines.push(arrow1, arrow2);

    // Draw label
    const label = createDistanceLabel(
      `${distance}px`,
      x,
      (y1 + y2) / 2,
      '#9b59b6'
    );
    document.body.appendChild(label);
    S.measurementLabels.push(label);
  }

  function createArrow(x, y, direction) {
    const arrow = document.createElement("div");
    arrow.className = "di-ruler-arrow";

    const size = 6;
    let borderStyle = '';

    switch (direction) {
      case 'left':
        borderStyle = `${size}px solid transparent; border-right: ${size}px solid #e74c3c`;
        x = x - size;
        y = y - size;
        break;
      case 'right':
        borderStyle = `${size}px solid transparent; border-left: ${size}px solid #e74c3c`;
        x = x;
        y = y - size;
        break;
      case 'up':
        borderStyle = `${size}px solid transparent; border-bottom: ${size}px solid #9b59b6`;
        x = x - size;
        y = y - size;
        break;
      case 'down':
        borderStyle = `${size}px solid transparent; border-top: ${size}px solid #9b59b6`;
        x = x - size;
        y = y;
        break;
    }

    Object.assign(arrow.style, {
      position: "absolute",
      top: y + "px",
      left: x + "px",
      width: "0",
      height: "0",
      border: borderStyle,
      pointerEvents: "none",
      zIndex: 99995
    });

    return arrow;
  }

  function showOverlapIndicator(rect1, rect2) {
    // Calculate overlap region
    const overlapLeft = Math.max(rect1.left, rect2.left);
    const overlapRight = Math.min(rect1.right, rect2.right);
    const overlapTop = Math.max(rect1.top, rect2.top);
    const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

    const centerX = ((overlapLeft + overlapRight) / 2) + window.scrollX;
    const centerY = ((overlapTop + overlapBottom) / 2) + window.scrollY;

    const label = createDistanceLabel(
      "OVERLAPPING",
      centerX,
      centerY,
      '#f39c12',
      true
    );
    label.style.fontSize = "12px";
    label.style.fontWeight = "700";

    document.body.appendChild(label);
    S.measurementLabels.push(label);
  }

  function calculateDistances(rect1, rect2) {
    // Calculate edge-to-edge distances (can be negative if overlapping)
    const topDistance = rect2.top - rect1.bottom;     // Distance from rect1 bottom to rect2 top
    const bottomDistance = rect1.top - rect2.bottom;   // Distance from rect2 bottom to rect1 top
    const leftDistance = rect2.left - rect1.right;     // Distance from rect1 right to rect2 left
    const rightDistance = rect1.left - rect2.right;    // Distance from rect2 right to rect1 left

    // Horizontal distance (X-axis) - minimum absolute distance
    let horizontalDistance = 0;
    if (rect1.right <= rect2.left) {
      // rect2 is to the right
      horizontalDistance = rect2.left - rect1.right;
    } else if (rect2.right <= rect1.left) {
      // rect2 is to the left
      horizontalDistance = rect1.left - rect2.right;
    } else {
      // Overlapping horizontally - distance is 0 or negative (inside)
      const leftOverlap = rect1.left - rect2.left;
      const rightOverlap = rect2.right - rect1.right;
      // If rect2 is inside rect1
      if (rect2.left >= rect1.left && rect2.right <= rect1.right) {
        horizontalDistance = Math.min(
          Math.abs(rect2.left - rect1.left),
          Math.abs(rect1.right - rect2.right)
        );
      }
      // If rect1 is inside rect2
      else if (rect1.left >= rect2.left && rect1.right <= rect2.right) {
        horizontalDistance = Math.min(
          Math.abs(rect1.left - rect2.left),
          Math.abs(rect2.right - rect1.right)
        );
      }
      // Partial overlap
      else {
        horizontalDistance = 0;
      }
    }

    // Vertical distance (Y-axis) - minimum absolute distance
    let verticalDistance = 0;
    if (rect1.bottom <= rect2.top) {
      // rect2 is below
      verticalDistance = rect2.top - rect1.bottom;
    } else if (rect2.bottom <= rect1.top) {
      // rect2 is above
      verticalDistance = rect1.top - rect2.bottom;
    } else {
      // Overlapping vertically
      const topOverlap = rect1.top - rect2.top;
      const bottomOverlap = rect2.bottom - rect1.bottom;
      // If rect2 is inside rect1
      if (rect2.top >= rect1.top && rect2.bottom <= rect1.bottom) {
        verticalDistance = Math.min(
          Math.abs(rect2.top - rect1.top),
          Math.abs(rect1.bottom - rect2.bottom)
        );
      }
      // If rect1 is inside rect2
      else if (rect1.top >= rect2.top && rect1.bottom <= rect2.bottom) {
        verticalDistance = Math.min(
          Math.abs(rect1.top - rect2.top),
          Math.abs(rect2.bottom - rect1.bottom)
        );
      }
      // Partial overlap
      else {
        verticalDistance = 0;
      }
    }

    // Overlapping detection
    const overlapX = !(rect1.right <= rect2.left || rect1.left >= rect2.right);
    const overlapY = !(rect1.bottom <= rect2.top || rect1.top >= rect2.bottom);

    return {
      horizontal: Math.round(Math.abs(horizontalDistance)),
      vertical: Math.round(Math.abs(verticalDistance)),
      overlapX,
      overlapY,
      // Keep individual edge distances for detailed measurement if needed
      topDistance: Math.round(topDistance),
      bottomDistance: Math.round(bottomDistance),
      leftDistance: Math.round(leftDistance),
      rightDistance: Math.round(rightDistance)
    };
  }

  function createDistanceLabel(text, x, y, color = '#e67e22', center = false) {
    const label = document.createElement("div");
    label.className = "di-distance-label";
    label.textContent = text;

    Object.assign(label.style, {
      position: "absolute",
      top: y + "px",
      left: x + "px",
      transform: center ? "translate(-50%, -50%)" : "translate(-50%, -50%)",
      background: `rgba(${hexToRgb(color)}, 0.95)`,
      color: "#fff",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "11px",
      fontFamily: "system-ui, monospace",
      fontWeight: "600",
      pointerEvents: "none",
      zIndex: 99998,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.2)"
    });

    return label;
  }

  function hexToRgb(hex) {
    // Simple hex to rgb converter for label backgrounds
    const colors = {
      '#e67e22': '230, 126, 34',
      '#e74c3c': '231, 76, 60',
      '#9b59b6': '155, 89, 182',
      '#2ecc71': '46, 204, 113'
    };
    return colors[hex] || '230, 126, 34';
  }

  function clearRulerVisuals() {
    S.rulerLines.forEach(line => remove(line));
    S.rulerLines = [];

    S.measurementLabels.forEach(label => remove(label));
    S.measurementLabels = [];
  }

  /*  CLEANUP  */
  function cleanup() {
    console.log('[DOM Inspector] Cleaning up...');
    setState(STATES.CLEANING);

    detachEventListeners();
    stopDrag();
    // Cleanup ruler mode
    if (S.rulerMode) {
      stopRulerMode();
    }
    clearRulerVisuals();

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

    // Remove responsive button
    const responsiveBtn = document.getElementById("dom-responsive-btn");
    if (responsiveBtn) remove(responsiveBtn);

    // Remove FAB container (includes all buttons)
    remove(S.inspectBtn);
    S.inspectBtn = null;

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

    if (S.rulerMode) {
      stopRulerMode();
    }
    S.rulerMode = false;
    S.rulerLines = [];
    S.measurementLabels = [];
    S.firstSelectedElement = null;
    // Cleanup outline mode
    if (S.outlineMode) {
      stopOutlineMode();
    }
    S.outlineMode = false;
    S.outlineStyleElement = null;
  }

  /*  MESSAGES  */
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "START_INSPECT") {
        showInspectorButtons();
      } else if (msg.type === "CLEAR_OVERLAY") {
        cleanup();
        hideInspectorButtons();
      } else if (msg.type === "TOGGLE_OUTLINE") {
        showInspectorButtons();
        if (!S.outlineMode) {
          startOutlineMode();
          const outlineBtn = document.getElementById("dom-outline-btn");
          if (outlineBtn) {
            outlineBtn.innerHTML = "✕";
            outlineBtn.parentElement.querySelector("span").textContent = "Exit Outline";
          }
        } else {
          stopOutlineMode();
          const outlineBtn = document.getElementById("dom-outline-btn");
          if (outlineBtn) {
            outlineBtn.innerHTML = "⬚";
            outlineBtn.parentElement.querySelector("span").textContent = "Outline All";
          }
        }
      } else if (msg.type === "TOGGLE_RULER") {
        showInspectorButtons();
        if (!S.rulerMode) {
          startRulerMode();
          const rulerBtn = document.getElementById("dom-ruler-btn");
          if (rulerBtn) {
            rulerBtn.innerHTML = "✕";
            rulerBtn.parentElement.querySelector("span").textContent = "Exit Distance";
          }
        } else {
          stopRulerMode();
          const rulerBtn = document.getElementById("dom-ruler-btn");
          if (rulerBtn) {
            rulerBtn.innerHTML = "📏";
            rulerBtn.parentElement.querySelector("span").textContent = "Measure Distance";
          }
        }
      } else if (msg.type === "TOGGLE_RESPONSIVE") {
        showInspectorButtons();
        if (!S.responsiveMode) {
          enterResponsiveMode();
          const responsiveBtn = document.getElementById("dom-responsive-btn");
          if (responsiveBtn) {
            responsiveBtn.innerHTML = "✕";
            responsiveBtn.parentElement.querySelector("span").textContent = "Exit Responsive";
          }
        } else {
          exitResponsiveMode();
          const responsiveBtn = document.getElementById("dom-responsive-btn");
          if (responsiveBtn) {
            responsiveBtn.innerHTML = "📱";
            responsiveBtn.parentElement.querySelector("span").textContent = "Responsive Mode";
          }
        }
      }
    });
  }

  // Initialize
  setState(STATES.IDLE);

  console.log('[DOM Inspector] Enhanced version initialized with:');
  console.log('  ✓ Element path breadcrumb (clickable)');
  console.log('  ✓ Live CSS diff (non-default styles only)');
  console.log('  ✓ Pseudo-state inspector (:hover, :focus, :active)');
  console.log('  ✓ Grid/Flex visual helpers');
  console.log('  ✓ Performance-safe RAF throttling');
  console.log('  ✓ Responsive Design Testing');
  console.log('  ✓ Ruler & Distance Measurement');
  console.log('  ✓ Outline All Elements Mode');
})();