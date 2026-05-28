import { S, STATES, setState } from './core/state.js';
import { startOutlineMode, stopOutlineMode } from './features/outline.js';
import { startRulerMode, stopRulerMode } from './features/ruler.js';
import { enterResponsiveMode, exitResponsiveMode } from './features/responsive.js';
import { cleanup } from './ui/cleanup.js';
import { showInspectorButtons, hideInspectorButtons } from './ui/fab.js';

// Prevent multiple instances
if (window.__DOM_INSPECTOR__) {
  console.log('[DOM Inspector] Already initialized');
} else {
  window.__DOM_INSPECTOR__ = true;

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
}
