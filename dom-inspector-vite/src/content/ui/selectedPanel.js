import { S, STATES, setState, isValidState } from '../core/state.js';
import { remove, isInspectorElement } from '../core/utils.js';
import { getData } from '../css/engine.js';
import { cssText, cssTextAll, cssTextPlain } from '../css/formatter.js';
import { createPseudoStateToggle } from '../css/pseudoStates.js';
import { updateBoxModelLayers } from '../features/boxModel.js';
import { updateHoverPanel, positionHoverPanel } from './hoverPanel.js';
import { renderPrefsPanel, destroyPrefsPanel } from './prefsPanel.js';

let activeTab = 'inspect';

function applyTabState() {
  if (!S.panelContainer) return;
  const content = S.panelContainer.querySelector('.di-panel-content');
  const inspectBtn = S.panelContainer.querySelector('.di-tab-inspect');
  const prefsBtn = S.panelContainer.querySelector('.di-tab-prefs');
  if (!content) return;

  if (activeTab === 'prefs') {
    content.querySelectorAll('.di-panel-item').forEach(el => { el.style.display = 'none'; });
    let host = content.querySelector('.di-prefs-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'di-prefs-host';
      content.appendChild(host);
    }
    renderPrefsPanel(host);
  } else {
    destroyPrefsPanel();
    const host = content.querySelector('.di-prefs-host');
    if (host) host.remove();
    content.querySelectorAll('.di-panel-item').forEach(el => { el.style.display = ''; });
  }

  [inspectBtn, prefsBtn].forEach(btn => {
    if (!btn) return;
    const isActive = (btn === inspectBtn && activeTab === 'inspect') || (btn === prefsBtn && activeTab === 'prefs');
    btn.style.background = isActive ? 'rgba(79, 195, 247, 0.2)' : 'transparent';
    btn.style.color = isActive ? '#4fc3f7' : '#999';
    btn.style.borderColor = isActive ? 'rgba(79, 195, 247, 0.4)' : 'transparent';
  });
}

export function switchTab(name) {
  if (name !== 'inspect' && name !== 'prefs') return;
  activeTab = name;
  applyTabState();
}

export function getActiveTab() {
  return activeTab;
}

export function createBreadcrumb(path, data, panelItem) {
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

    // Click to navigate to parent element - UPDATE PANEL & ADD TO HISTORY
    part.onclick = (e) => {
      e.stopPropagation();
      let current = data.el;
      const stepsBack = path.length - 1 - i;

      for (let j = 0; j < stepsBack && current.parentElement; j++) {
        current = current.parentElement;
      }

      if (current && !isInspectorElement(current)) {
        const newData = getData(current);

        // Update box model visualization
        updateBoxModelLayers(newData);

        // Update hover panel if visible
        if (S.hoverPanel && S.hoverPanel.style.display !== 'none') {
          updateHoverPanel(newData);
          positionHoverPanel(newData);
        }

        // Update the panel item content (if panelItem is provided)
        if (panelItem) {
          // Add to history BEFORE updating
          if (!panelItem.breadcrumbHistory) {
            panelItem.breadcrumbHistory = [data];
            panelItem.currentHistoryIndex = 0;
          }

          // Remove any "future" history if we're not at the end
          if (panelItem.currentHistoryIndex < panelItem.breadcrumbHistory.length - 1) {
            panelItem.breadcrumbHistory = panelItem.breadcrumbHistory.slice(0, panelItem.currentHistoryIndex + 1);
          }

          // Add new state to history
          panelItem.breadcrumbHistory.push(newData);
          panelItem.currentHistoryIndex = panelItem.breadcrumbHistory.length - 1;

          // Update panel content (DON'T update breadcrumb - keep it as is)
          updatePanelItemContent(panelItem, newData, false); // false = don't update breadcrumb

          // Show undo button
          const undoBtn = panelItem.querySelector('.di-undo-btn');
          if (undoBtn) {
            undoBtn.style.display = "flex";
          }
        }
      }
    };

    breadcrumb.appendChild(part);
  });

  return breadcrumb;
}

// Update panel item when breadcrumb changes (with option to preserve breadcrumb)
export function updatePanelItemContent(panelItem, newData, updateBreadcrumb = true) {
  if (!panelItem) return;

  // Update breadcrumb ONLY if updateBreadcrumb is true
  if (updateBreadcrumb) {
    const breadcrumbContainer = panelItem.querySelector('.di-breadcrumb-container');
    if (breadcrumbContainer) {
      const oldBreadcrumb = breadcrumbContainer.querySelector('.di-breadcrumb');
      if (oldBreadcrumb) {
        const newBreadcrumb = createBreadcrumb(newData.path, newData, panelItem);
        oldBreadcrumb.replaceWith(newBreadcrumb);
      }
    }
  }

  // Update collapsible header (selector + dimensions)
  const headerLeft = panelItem.querySelector('.di-collapsible-header > div');
  if (headerLeft) {
    headerLeft.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
      <b style="color: #4fc3f7; font-size: 12px;">${newData.selector}</b>
      <span style="
        background: rgba(76, 175, 80, 0.2);
        color: #4caf50;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: 600;
        border: 1px solid rgba(76, 175, 80, 0.3);
      ">${newData.display}</span>
    </div>
    <div style="color: #999; font-size: 10px; font-family: monospace;">
      📐 ${newData.width} × ${newData.height}
    </div>
  `;
  }

  // Update CSS preview
  const cssPreview = panelItem.querySelector('.di-css-preview');
  if (cssPreview) {
    // Check if currently showing all
    const showAllBtn = panelItem.querySelector('.di-show-all-btn');
    const showingAll = showAllBtn && showAllBtn.textContent === "Show Less";

    cssPreview.innerHTML = cssText(newData, showingAll);
  }

  // Update pseudo-states section
  const contentArea = panelItem.querySelector('.di-content-area');
  if (contentArea) {
    // Remove old pseudo-states
    const oldPseudoPanel = contentArea.querySelector('.di-pseudo-state-panel');
    if (oldPseudoPanel) {
      oldPseudoPanel.remove();
    }

    // Add new pseudo-states if available
    const newPseudoControls = createPseudoStateToggle(newData);
    if (newPseudoControls) {
      // Insert before CSS container
      const cssContainer = contentArea.querySelector('div');
      if (cssContainer) {
        contentArea.insertBefore(newPseudoControls, cssContainer);
      } else {
        contentArea.appendChild(newPseudoControls);
      }
    }
  }

  // Update copy button to use new data
  const copyBtn = panelItem.querySelector('.di-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(cssTextPlain(newData));
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => copyBtn.textContent = "Copy CSS", 1500);
    };
  }

  // Update "Show All CSS" button reference
  const showAllBtn = panelItem.querySelector('.di-show-all-btn');
  if (showAllBtn) {
    let showingAll = showAllBtn.textContent === "Show Less";

    showAllBtn.onclick = (e) => {
      e.stopPropagation();
      showingAll = !showingAll;

      if (showingAll) {
        cssPreview.innerHTML = cssTextAll(data); // Show ALL CSS without filtering
        showAllBtn.textContent = "Show Less";
        showAllBtn.style.background = "rgba(106, 90, 205, 0.4)";
      } else {
        cssPreview.innerHTML = cssText(data, false); // Show filtered CSS
        showAllBtn.textContent = "Show All CSS";
        showAllBtn.style.background = "rgba(106, 90, 205, 0.2)";
      }
    };
  }
}

export function ensurePanelContainer() {
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

    const tabStrip = document.createElement("div");
    tabStrip.className = "di-tab-strip";
    tabStrip.style.cssText = "display:flex; gap:4px; align-items:center;";

    const makeTabBtn = (name, label) => {
      const btn = document.createElement("button");
      btn.className = `di-tab-btn di-tab-${name}`;
      btn.textContent = label;
      btn.style.cssText = `
        background: transparent;
        border: 1px solid transparent;
        color: #999;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 3px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      `;
      btn.onclick = (e) => {
        e.stopPropagation();
        switchTab(name);
      };
      btn.onmousedown = (e) => e.stopPropagation();
      return btn;
    };

    const inspectTab = makeTabBtn("inspect", "Inspect");
    const prefsTab = makeTabBtn("prefs", "Prefs");
    tabStrip.append(inspectTab, prefsTab);

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

    header.appendChild(tabStrip);
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
    applyTabState();
  }
}

export function togglePanelCollapse() {
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

export function startDrag(e) {
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

export function drag(e) {
  if (!S.isDragging || !S.panelContainer) return;

  const x = e.clientX - S.dragOffsetX;
  const y = e.clientY - S.dragOffsetY;

  S.panelX = Math.max(0, Math.min(x, window.innerWidth - S.panelContainer.offsetWidth));
  S.panelY = Math.max(0, Math.min(y, window.innerHeight - 50));

  S.panelContainer.style.left = S.panelX + "px";
  S.panelContainer.style.top = S.panelY + "px";
}

export function stopDrag() {
  S.isDragging = false;
  if (S.handlers.drag) document.removeEventListener("mousemove", S.handlers.drag);
  if (S.handlers.stopDrag) document.removeEventListener("mouseup", S.handlers.stopDrag);
}

/*  SELECTED ITEMS  */
export function addSelected(data) {
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

  const item = document.createElement("div");
  item.className = "di-panel-item";
  item.setAttribute('data-element-id', Date.now()); // Unique ID for updating
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

  // Store breadcrumb history for this panel item
  item.breadcrumbHistory = [data];
  item.currentHistoryIndex = 0;

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

  // Breadcrumb with history support (DON'T update breadcrumb itself)
  const breadcrumbContainer = document.createElement("div");
  breadcrumbContainer.className = "di-breadcrumb-container";
  breadcrumbContainer.style.cssText = "position: relative;";

  const breadcrumb = createBreadcrumb(data.path, data, item);
  breadcrumbContainer.appendChild(breadcrumb);

  // Undo button (only show if history exists)
  const undoBtn = document.createElement("button");
  undoBtn.className = "di-undo-btn";
  undoBtn.innerHTML = "↶";
  undoBtn.title = "Go back to previous element";
  undoBtn.style.cssText = `
position: absolute;
top: 6px;
right: 6px;
background: rgba(255, 152, 0, 0.2);
border: 1px solid rgba(255, 152, 0, 0.4);
color: #ff9800;
width: 24px;
height: 24px;
border-radius: 3px;
cursor: pointer;
font-size: 14px;
display: none;
align-items: center;
justify-content: center;
transition: all 0.2s;
`;

  undoBtn.onmouseenter = () => {
    undoBtn.style.background = "rgba(255, 152, 0, 0.4)";
    undoBtn.style.transform = "scale(1.1)";
  };
  undoBtn.onmouseleave = () => {
    undoBtn.style.background = "rgba(255, 152, 0, 0.2)";
    undoBtn.style.transform = "scale(1)";
  };

  undoBtn.onclick = (e) => {
    e.stopPropagation();

    if (item.currentHistoryIndex > 0) {
      item.currentHistoryIndex--;
      const previousData = item.breadcrumbHistory[item.currentHistoryIndex];

      // Update everything EXCEPT breadcrumb
      updatePanelItemContent(item, previousData, false); // false = don't update breadcrumb
      updateBoxModelLayers(previousData);

      // Hide undo button if at start of history
      if (item.currentHistoryIndex === 0) {
        undoBtn.style.display = "none";
      }
    }
  };

  breadcrumbContainer.appendChild(undoBtn);
  item.appendChild(breadcrumbContainer);

  // Collapsible Header (selector + dimensions)
  const collapsibleHeader = document.createElement("div");
  collapsibleHeader.className = "di-collapsible-header";
  collapsibleHeader.style.cssText = `
display: flex;
align-items: center;
justify-content: space-between;
padding: 8px 10px;
background: rgba(0, 0, 0, 0.3);
border-radius: 4px;
cursor: pointer;
user-select: none;
border: 1px solid rgba(79, 195, 247, 0.2);
margin-bottom: 8px;
transition: all 0.2s;
`;

  const headerLeft = document.createElement("div");
  headerLeft.style.cssText = "flex: 1;";
  headerLeft.innerHTML = `
<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
  <b style="color: #4fc3f7; font-size: 12px;">${data.selector}</b>
  <span style="
    background: rgba(76, 175, 80, 0.2);
    color: #4caf50;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    border: 1px solid rgba(76, 175, 80, 0.3);
  ">${data.display}</span>
</div>
<div style="color: #999; font-size: 10px; font-family: monospace;">
  📐 ${data.width} × ${data.height}
</div>
`;

  const headerToggle = document.createElement("span");
  headerToggle.textContent = "▼";
  headerToggle.style.cssText = `
font-size: 10px;
color: #666;
transition: transform 0.2s;
margin-left: 8px;
`;

  collapsibleHeader.appendChild(headerLeft);
  collapsibleHeader.appendChild(headerToggle);
  item.appendChild(collapsibleHeader);

  // Content area (pseudo-states + CSS)
  const contentArea = document.createElement("div");
  contentArea.className = "di-content-area";
  contentArea.style.cssText = "display: block;";

  // Pseudo-state controls (only if element has pseudo-states)
  const pseudoControls = createPseudoStateToggle(data);
  if (pseudoControls) {
    contentArea.appendChild(pseudoControls);
  }

  // CSS Preview Container
  const cssContainer = document.createElement("div");
  cssContainer.style.cssText = "margin-top: 8px;";

  // CSS Preview (line-by-line, larger text, NO width/height)
  const cssPreview = document.createElement("div");
  cssPreview.className = "di-css-preview";
  cssPreview.style.cssText = `
background: rgba(0, 0, 0, 0.4);
padding: 12px;
border-radius: 4px;
font-size: 11.5px;
overflow-x: auto;
max-height: 250px;
overflow-y: auto;
line-height: 1.6;
border: 1px solid rgba(255, 255, 255, 0.1);
color: #d4d4d4;
`;

  // Use colorized CSS (line-by-line format, NOT showing all by default)
  cssPreview.innerHTML = cssText(data, false);

  cssContainer.appendChild(cssPreview);

  // "Show All CSS" button
  const showAllBtn = document.createElement("button");
  showAllBtn.className = "di-show-all-btn";
  showAllBtn.textContent = "Show All CSS";
  showAllBtn.style.cssText = `
margin-top: 8px;
padding: 6px 12px;
background: rgba(106, 90, 205, 0.2);
border: 1px solid rgba(106, 90, 205, 0.4);
color: #9370db;
border-radius: 4px;
cursor: pointer;
font-size: 10px;
font-weight: 600;
transition: all 0.2s;
width: 100%;
text-transform: uppercase;
letter-spacing: 0.5px;
`;

  let showingAll = false;

  showAllBtn.onmouseenter = () => {
    showAllBtn.style.background = "rgba(106, 90, 205, 0.3)";
    showAllBtn.style.transform = "translateY(-1px)";
  };
  showAllBtn.onmouseleave = () => {
    showAllBtn.style.background = "rgba(106, 90, 205, 0.2)";
    showAllBtn.style.transform = "translateY(0)";
  };

  showAllBtn.onclick = (e) => {
    e.stopPropagation();
    showingAll = !showingAll;

    // Find the panel item and CSS preview element
    const clickedPanelItem = e.target.closest('.di-panel-item');
    if (!clickedPanelItem) return;

    const cssPreviewElement = clickedPanelItem.querySelector('.di-css-preview');
    if (!cssPreviewElement) return;

    // Get current data from selectedItems
    const selectedItem = S.selectedItems.find(item => item.item === clickedPanelItem);
    if (!selectedItem) return;

    const currentData = selectedItem.data;

    if (showingAll) {
      cssPreviewElement.innerHTML = cssTextAll(currentData); // Show ALL CSS
      showAllBtn.textContent = "Show Less";
      showAllBtn.style.background = "rgba(106, 90, 205, 0.4)";
    } else {
      cssPreviewElement.innerHTML = cssText(currentData, false); // Show filtered CSS
      showAllBtn.textContent = "Show All CSS";
      showAllBtn.style.background = "rgba(106, 90, 205, 0.2)";
    }
  };

  cssContainer.appendChild(showAllBtn);
  contentArea.appendChild(cssContainer);
  item.appendChild(contentArea);

  // Toggle collapse on header click
  let isCollapsed = false;
  collapsibleHeader.onclick = (e) => {
    e.stopPropagation();
    isCollapsed = !isCollapsed;

    if (isCollapsed) {
      contentArea.style.display = "none";
      headerToggle.style.transform = "rotate(-90deg)";
      collapsibleHeader.style.background = "rgba(0, 0, 0, 0.2)";
    } else {
      contentArea.style.display = "block";
      headerToggle.style.transform = "rotate(0deg)";
      collapsibleHeader.style.background = "rgba(0, 0, 0, 0.3)";
    }
  };

  // Action Buttons (smaller size)
  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = "display: flex; gap: 6px; margin-top: 8px;";

  const copyBtn = document.createElement("button");
  copyBtn.className = "di-button di-copy-btn";
  copyBtn.textContent = "Copy CSS";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(cssTextPlain(data));
    copyBtn.textContent = "✓ Copied!";
    setTimeout(() => copyBtn.textContent = "Copy CSS", 1500);
  };

  const clearBtn = document.createElement("button");
  clearBtn.className = "di-button di-clear-btn";
  clearBtn.textContent = "Remove";

  // SMALLER button styles
  [copyBtn, clearBtn].forEach(b => Object.assign(b.style, {
    padding: "6px 10px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "10px",
    fontWeight: "600",
    transition: "all 0.2s",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
    textTransform: "uppercase",
    letterSpacing: "0.3px"
  }));

  copyBtn.style.background = "linear-gradient(135deg, #007acc 0%, #005a9e 100%)";
  copyBtn.style.color = "#fff";
  copyBtn.style.border = "1px solid rgba(255, 255, 255, 0.1)";

  clearBtn.style.background = "linear-gradient(135deg, #dc3545 0%, #bd2130 100%)";
  clearBtn.style.color = "#fff";
  clearBtn.style.border = "1px solid rgba(255, 255, 255, 0.1)";

  copyBtn.onmouseenter = () => copyBtn.style.transform = "translateY(-1px)";
  copyBtn.onmouseleave = () => copyBtn.style.transform = "translateY(0)";
  clearBtn.onmouseenter = () => clearBtn.style.transform = "translateY(-1px)";
  clearBtn.onmouseleave = () => clearBtn.style.transform = "translateY(0)";

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
  item.appendChild(btnContainer);

  const content = S.panelContainer?.querySelector(".di-panel-content");
  if (content) {
    content.appendChild(item);
    if (activeTab === 'prefs') item.style.display = 'none';
  }

  S.selectedItems.push({ overlay, item, data });
}
