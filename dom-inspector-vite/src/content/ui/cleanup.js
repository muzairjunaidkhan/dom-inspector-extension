import { S, STATES, setState, elementDataCache, cacheInvalidationFrame, setCacheInvalidationFrame } from '../core/state.js';
import { remove } from '../core/utils.js';
import { clearGridFlexOverlays } from '../features/boxModel.js';
import { stopRulerMode, clearRulerVisuals } from '../features/ruler.js';
import { stopOutlineMode } from '../features/outline.js';
import { exitResponsiveMode } from '../features/responsive.js';
import { detachEventListeners } from '../features/inspector.js';
import { stopDrag } from './selectedPanel.js';

/*  CLEANUP  */
export function cleanup() {
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

  // Cleanup outline mode
  if (S.outlineMode) {
    stopOutlineMode();
  }

  // Clean up iframe handlers
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
    setCacheInvalidationFrame(null);
  }

  // Clear cache
  elementDataCache.clear();

  // Disconnect resize observer
  if (S.resizeObserver) {
    S.resizeObserver.disconnect();
    S.resizeObserver = null;
  }

  // ===================================
  // REMOVE ALL DOM ELEMENTS
  // ===================================

  // Remove FAB container (includes all buttons)
  remove(S.inspectBtn);
  const fabContainer = document.getElementById("dom-inspector-fab");
  if (fabContainer) remove(fabContainer);

  // Remove hover panel
  remove(S.hoverPanel);
  const hoverPanel = document.querySelector('.di-hover-panel');
  if (hoverPanel) remove(hoverPanel);

  // Remove selected panel container
  remove(S.panelContainer);
  const selectedPanel = document.querySelector('.di-selected-panel');
  if (selectedPanel) remove(selectedPanel);

  // Remove all box model layers
  Object.values(S.boxModelLayers).forEach(layer => remove(layer));
  document.querySelectorAll('.di-box-layer').forEach(el => remove(el));

  // Remove grid/flex overlays
  clearGridFlexOverlays();
  document.querySelectorAll('.di-grid-overlay, .di-flex-overlay').forEach(el => remove(el));

  // Clean up selected items and their overlays
  if (Array.isArray(S.selectedItems)) {
    S.selectedItems.forEach(i => {
      remove(i.overlay);
      remove(i.item);
      if (i.data && i.data.el) {
        i.data.el.classList.remove('di-force-hover', 'di-force-focus', 'di-force-active', 'di-force-focus-visible');
      }
    });
  }

  // Remove any remaining selected overlays
  document.querySelectorAll('.di-selected-overlay').forEach(el => remove(el));
  document.querySelectorAll('.di-panel-item').forEach(el => remove(el));

  // Clean up pseudo-state styles
  ['hover', 'focus', 'active', 'focus-visible'].forEach(state => {
    const style = document.getElementById(`di-pseudo-style-${state}`);
    if (style) remove(style);

    // Also remove any dynamically created force styles
    const forceStyle = document.getElementById(`di-pseudo-force-${state}`);
    if (forceStyle) remove(forceStyle);

    // Remove styles with timestamp IDs
    document.querySelectorAll(`[id^="di-pseudo-force-${state}-"]`).forEach(el => remove(el));
  });

  // Remove ruler elements
  S.rulerLines.forEach(line => remove(line));
  S.measurementLabels.forEach(label => remove(label));
  document.querySelectorAll('.di-ruler-highlight, .di-ruler-selected, .di-ruler-target, .di-ruler-line, .di-ruler-arrow, .di-distance-label, .di-ruler-label').forEach(el => remove(el));

  // Remove outline mode style
  const outlineStyle = document.getElementById('di-outline-mode-style');
  if (outlineStyle) remove(outlineStyle);

  // Remove responsive mode elements
  document.querySelectorAll('.di-viewport-overlay, .di-frame-container, .di-viewport-toolbar, .di-loading-indicator').forEach(el => remove(el));

  // Remove any other inspector elements by class
  document.querySelectorAll('[class*="di-"]').forEach(el => {
    // Only remove if it's actually an inspector element
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(' ');
      if (classes.some(c => c.startsWith('di-'))) {
        remove(el);
      }
    }
  });

  // ===================================
  // RESTORE ORIGINAL STATE
  // ===================================

  // Restore body styles
  document.body.style.cursor = "default";
  if (S.originalBodyOverflow !== undefined) {
    document.body.style.overflow = S.originalBodyOverflow;
  }

  // ===================================
  // RESET ALL STATE VARIABLES
  // ===================================

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
  S.buttonsVisible = false;
  S.fabMenuOpen = false;
  S.panelCollapsed = false;
  S.rulerMode = false;
  S.rulerLines = [];
  S.measurementLabels = [];
  S.firstSelectedElement = null;
  S.outlineMode = false;
  S.outlineStyleElement = null;
  S.originalBodyOverflow = undefined;
  S.originalViewportMeta = undefined;

  // Reset handlers
  S.handlers = {
    mousemove: null,
    click: null,
    keydown: null,
    scroll: null,
    drag: null,
    stopDrag: null,
    rulerMouseMove: null,
    rulerClick: null,
    rulerKeyDown: null
  };

  // Reset global flag
  window.__DOM_INSPECTOR__ = false;

  console.log('[DOM Inspector] Complete cleanup finished - all elements removed');
}
