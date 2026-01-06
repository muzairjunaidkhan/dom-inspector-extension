(() => {
  if (window.__DOM_INSPECTOR__) return;
  window.__DOM_INSPECTOR__ = true;

  let inspecting = false;

  let hoverOverlay = null;
  let hoverPanel = null;
  let panelContainer = null;

  const selectedOverlays = [];

  /* ------------------ HELPERS ------------------ */

  const safeRemove = (el) => {
    if (el && el.parentNode) el.remove();
  };

  const getBoxModelStyles = (el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return {
      el,
      rect,
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      class: el.className || "",
      fontSize: cs.fontSize,
      color: cs.color,
      background: cs.backgroundColor,
      margin: cs.margin,
      padding: cs.padding,
      width: rect.width.toFixed(0) + "px",
      height: rect.height.toFixed(0) + "px",
    };
  };

  /* ------------------ UI CREATION ------------------ */

  const createHoverOverlay = () => {
    hoverOverlay = document.createElement("div");
    Object.assign(hoverOverlay.style, {
      position: "absolute",
      pointerEvents: "none",
      border: "2px dashed red",
      background: "rgba(255,0,0,0.1)",
      zIndex: 99998,
    });
    document.body.appendChild(hoverOverlay);
  };

  const createHoverPanel = () => {
    hoverPanel = document.createElement("div");
    hoverPanel.id = "dom-inspector-hover-panel";
    Object.assign(hoverPanel.style, {
      position: "fixed",
      top: "10px",
      left: "10px",
      width: "300px",
      background: "#222",
      color: "#fff",
      fontFamily: "monospace",
      fontSize: "12px",
      padding: "8px",
      borderRadius: "6px",
      zIndex: 99999,
      pointerEvents: "none",
      boxShadow: "0 0 10px rgba(0,0,0,.5)",
    });
    document.body.appendChild(hoverPanel);
  };

  const createPanelContainer = () => {
    panelContainer = document.createElement("div");
    panelContainer.id = "dom-inspector-panel-container";
    Object.assign(panelContainer.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      width: "320px",
      maxHeight: "80vh",
      overflow: "auto",
      background: "#1e1e1e",
      color: "#fff",
      fontFamily: "monospace",
      fontSize: "12px",
      padding: "10px",
      borderRadius: "6px",
      zIndex: 99999,
      boxShadow: "0 0 10px rgba(0,0,0,.5)",
    });
    document.body.appendChild(panelContainer);
  };

  /* ------------------ UPDATE UI ------------------ */

  const updateHoverOverlay = (rect) => {
    if (!hoverOverlay) return;
    Object.assign(hoverOverlay.style, {
      top: rect.top + "px",
      left: rect.left + "px",
      width: rect.width + "px",
      height: rect.height + "px",
    });
  };

  const updateHoverPanel = (d) => {
    if (!hoverPanel) return;
    hoverPanel.innerHTML = `
      <div><b>${d.tag}</b>${d.id ? "#" + d.id : ""}${d.class ? "." + d.class : ""}</div>
      <div>Font: ${d.fontSize}</div>
      <div>Color: ${d.color}</div>
      <div>Size: ${d.width} × ${d.height}</div>
      <div>Margin: ${d.margin}</div>
      <div>Padding: ${d.padding}</div>
    `;
  };

  /* ------------------ SELECTED OVERLAY ------------------ */

  const createSelectedOverlay = (rect) => {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "absolute",
      top: rect.top + "px",
      left: rect.left + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      border: "2px solid lime",
      background: "rgba(0,255,0,0.1)",
      zIndex: 99997,
      pointerEvents: "none",
    });
    document.body.appendChild(overlay);
    selectedOverlays.push(overlay);
    return overlay;
  };

  /* ------------------ PANEL ITEM ------------------ */

  const addPanelItem = (data) => {
    if (!panelContainer) createPanelContainer();

    const item = document.createElement("div");
    item.style.borderBottom = "1px solid #444";
    item.style.paddingBottom = "8px";
    item.style.marginBottom = "8px";

    item.innerHTML = `
      <div><b>${data.tag}</b>${data.id ? "#" + data.id : ""}${data.class ? "." + data.class : ""}</div>
      <div>Font: ${data.fontSize}</div>
      <div>Color: ${data.color}</div>
      <div>Size: ${data.width} × ${data.height}</div>
      <div>Margin: ${data.margin}</div>
      <div>Padding: ${data.padding}</div>
    `;

    const overlay = createSelectedOverlay(data.rect);

    const btnRow = document.createElement("div");
    btnRow.style.marginTop = "6px";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy CSS";
    styleBtn(copyBtn, "#007acc");
    copyBtn.onclick = () => {
      const css = `
${data.tag}${data.id ? "#" + data.id : ""}${data.class ? "." + data.class : ""} {
  font-size: ${data.fontSize};
  color: ${data.color};
  background: ${data.background};
  margin: ${data.margin};
  padding: ${data.padding};
  width: ${data.width};
  height: ${data.height};
}`;
      navigator.clipboard.writeText(css);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy CSS"), 1000);
    };

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    styleBtn(clearBtn, "#cc0000");
    clearBtn.onclick = () => {
      safeRemove(overlay);
      safeRemove(item);
      const i = selectedOverlays.indexOf(overlay);
      if (i > -1) selectedOverlays.splice(i, 1);
    };

    btnRow.append(copyBtn, clearBtn);
    item.appendChild(btnRow);
    panelContainer.appendChild(item);
  };

  const styleBtn = (btn, color) => {
    Object.assign(btn.style, {
      marginRight: "6px",
      padding: "4px 8px",
      border: "none",
      borderRadius: "4px",
      background: color,
      color: "#fff",
      cursor: "pointer",
    });
  };

  /* ------------------ CLEANUP ------------------ */

  const clearEverything = () => {
    inspecting = false;
    document.body.style.cursor = "default";

    safeRemove(hoverOverlay);
    safeRemove(hoverPanel);
    safeRemove(panelContainer);

    hoverOverlay = hoverPanel = panelContainer = null;

    selectedOverlays.forEach(o => safeRemove(o));
    selectedOverlays.length = 0;
  };

  /* ------------------ EVENTS ------------------ */

  document.addEventListener("mousemove", (e) => {
    if (!inspecting || !hoverOverlay || !hoverPanel) return;
    const data = getBoxModelStyles(e.target);
    updateHoverOverlay(data.rect);
    updateHoverPanel(data);
  });

  document.addEventListener("click", (e) => {
    if (!inspecting) return;
    e.preventDefault();
    e.stopPropagation();

    addPanelItem(getBoxModelStyles(e.target));
    inspecting = false;
    document.body.style.cursor = "default";
  });

  /* ------------------ MESSAGES ------------------ */

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_INSPECT") {
      inspecting = true;
      document.body.style.cursor = "crosshair";
      if (!hoverOverlay) createHoverOverlay();
      if (!hoverPanel) createHoverPanel();
    }

    if (msg.type === "CLEAR_OVERLAY") {
      clearEverything();
    }
  });
})();
