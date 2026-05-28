import { S, STATES } from '../core/state.js';
import { startInspect } from '../features/inspector.js';
import { startOutlineMode, stopOutlineMode } from '../features/outline.js';
import { startRulerMode, stopRulerMode } from '../features/ruler.js';
import { enterResponsiveMode, exitResponsiveMode } from '../features/responsive.js';

/*  UI CREATION - FLOATING ACTION BUTTON  */
export function ensureInspectButton() {
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


export function showInspectorButtons() {
  if (!S.buttonsVisible) {
    ensureInspectButton();
    if (S.inspectBtn) {
      S.inspectBtn.style.display = "block";
      S.buttonsVisible = true;
    }
  }
}

export function hideInspectorButtons() {
  if (S.inspectBtn) {
    S.inspectBtn.style.display = "none";
    S.buttonsVisible = false;
  }
}
