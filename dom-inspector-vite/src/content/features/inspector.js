import { S, STATES, setState, isValidState, elementDataCache } from '../core/state.js';
import { remove, isInspectorElement } from '../core/utils.js';
import { getData } from '../css/engine.js';
import { cssText } from '../css/formatter.js';
import { updateBoxModelLayers, hideBoxModelLayers } from './boxModel.js';
import { ensureHoverUI, updateHoverPanel, positionHoverPanel } from '../ui/hoverPanel.js';
import { addSelected } from '../ui/selectedPanel.js';
import { ensureInspectButton } from '../ui/fab.js';

/*  INSPECT FLOW  */
export function startInspect() {
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

export function stopInspect() {
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
export function attachEventListeners() {
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

export function detachEventListeners() {
  if (S.handlers.mousemove) document.removeEventListener("mousemove", S.handlers.mousemove);
  if (S.handlers.click) document.removeEventListener("click", S.handlers.click, true);
  if (S.handlers.keydown) document.removeEventListener("keydown", S.handlers.keydown);
  if (S.handlers.scroll) document.removeEventListener("scroll", S.handlers.scroll, true);
}

export function processMouseMove() {
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

export function handleMouseMove(e) {
  if (!isValidState() || !S.inspecting) return;

  S.pendingMouseEvent = e;

  if (!S.rafId) {
    S.rafId = requestAnimationFrame(processMouseMove);
  }
}

export function handleClick(e) {
  if (!isValidState() || !S.inspecting) return;

  if (isInspectorElement(e.target)) return;

  e.preventDefault();
  e.stopPropagation();
  addSelected(getData(e.target));
  stopInspect();
}

export function handleKeyDown(e) {
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

export function handleScroll() {
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
export function initializeResizeObserver() {
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
