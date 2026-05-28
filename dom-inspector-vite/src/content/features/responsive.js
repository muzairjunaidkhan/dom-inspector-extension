import { S, STATES, setState } from '../core/state.js';
import { remove, isInspectorElement, rgbToHex } from '../core/utils.js';
import { viewportPresets } from '../core/constants.js';
import { getElementPath } from '../css/engine.js';
import { clearGridFlexOverlays } from './boxModel.js';
import { stopInspect } from './inspector.js';
import { updateHoverPanel } from '../ui/hoverPanel.js';
import { addSelected } from '../ui/selectedPanel.js';

// NEW RESPONSIVE DESIGN TESTING - PROPER IMPLEMENTATION
export function createViewportFrame() {
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

export function setupIframeLoad(iframe, loadingIndicator) {
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

export function injectInspectorIntoIframe(iframe) {
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

{
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
        color: rgbToHex(cs.color),
        background: rgbToHex(cs.backgroundColor),
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
}

export function positionHoverPanelFixed(data) {
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

// Helper: Create dimension input
export function createDimensionInput(id, value, label) {
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
export function createSeparator() {
  const sep = document.createElement("div");
  sep.className = "di-toolbar-separator";
  sep.style.cssText = "width: 1px; height: 24px; background: rgba(255,255,255,0.1);";
  return sep;
}

// Helper: Create preset dropdown
export function createPresetDropdown() {
  const container = document.createElement("div");
  container.className = "di-toolbar-presets";
  container.style.cssText = "position: relative;";

  const select = document.createElement("select");
  select.id = "di-preset-select";
  Object.assign(select.style, {
    padding: "4px 24px 4px 8px",
    background: "rgba(255,255,255,0.95)",  // ← Lighter background
    border: "1px solid rgba(0,0,0,0.2)",   // ← Darker border
    borderRadius: "3px",
    color: "#000",  // ← BLACK text
    fontSize: "11px",
    cursor: "pointer",
    appearance: "none",
    minWidth: "180px",
    backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27%3e%3cpath fill=%27%23333%27 d=%27M0 0l6 8 6-8z%27/%3e%3c/svg%3e')",  // ← Darker arrow
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center"
  });

  select.onfocus = () => {
    select.style.borderColor = "#007acc";
    select.style.boxShadow = "0 0 0 2px rgba(0, 122, 204, 0.2)";  // ← Add focus ring
  };
  select.onblur = () => {
    select.style.borderColor = "rgba(0,0,0,0.2)";
    select.style.boxShadow = "none";
  };

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
export function createToolbarButton(text, onClick) {
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
export function adjustZoom(delta) {
  const newZoom = Math.max(0.25, Math.min(2, S.viewportFrame.zoomLevel + delta));
  setZoom(newZoom);
}
export function setZoom(zoom) {
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
export function applyViewport(preset) {
  if (!S.responsiveMode) return;

  S.currentViewport = { ...preset };

  applyViewportToIframe(preset);

  // Update UI displays
  updateViewportDisplays(preset);
}
export function applyViewportToIframe(preset) {
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
export function autoFitZoom(preset) {
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
export function updateViewportDisplays(preset) {
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


export function getDataFromIframeElement(el) {
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
export function updateIframeBoxModelLayers(data) {
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
export function addIframeGridOverlay(data) {
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
export function addIframeFlexOverlay(data) {
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

export function enterResponsiveMode() {
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

export function exitResponsiveMode() {
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
