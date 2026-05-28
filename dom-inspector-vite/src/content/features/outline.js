import { S } from '../core/state.js';
import { remove } from '../core/utils.js';

/*  OUTLINE MODE  */

export function startOutlineMode() {
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

export function stopOutlineMode() {
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
