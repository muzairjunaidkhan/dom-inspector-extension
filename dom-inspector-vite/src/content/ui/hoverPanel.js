import { S } from '../core/state.js';
import { isNonDefaultCSS } from '../css/engine.js';

export function updateHoverPanel(data) {
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

export function ensureHoverUI() {
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
export function positionHoverPanel(data) {
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
