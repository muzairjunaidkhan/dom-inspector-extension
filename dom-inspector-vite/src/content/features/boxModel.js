import { S, isValidState } from '../core/state.js';
import { remove } from '../core/utils.js';

/*  GRID/FLEX VISUALIZATION  */
export function clearGridFlexOverlays() {
  S.gridFlexOverlays.forEach(overlay => remove(overlay));
  S.gridFlexOverlays = [];
}

export function addGridOverlay(data) {
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

export function addFlexOverlay(data) {
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
export function updateBoxModelLayers(data) {
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

export function hideBoxModelLayers() {
  Object.values(S.boxModelLayers).forEach(layer => {
    if (layer && layer.style) layer.style.display = "none";
  });
  clearGridFlexOverlays();
}
