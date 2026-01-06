// Avoid redeclaration if content.js is injected multiple times
if (!window.__DOM_INSPECTOR__) {
  window.__DOM_INSPECTOR__ = true;

  window.inspecting = false;
  let hoverOverlay;

  function createOverlay() {
    if (!hoverOverlay) {
      hoverOverlay = document.createElement("div");
      hoverOverlay.style.position = "absolute";
      hoverOverlay.style.pointerEvents = "none";
      hoverOverlay.style.border = "2px dashed red";
      hoverOverlay.style.zIndex = "9999";
      document.body.appendChild(hoverOverlay);
    }
  }

  function updateOverlay(el) {
    const rect = el.getBoundingClientRect();
    hoverOverlay.style.top = rect.top + "px";
    hoverOverlay.style.left = rect.left + "px";
    hoverOverlay.style.width = rect.width + "px";
    hoverOverlay.style.height = rect.height + "px";
  }

  function removeOverlay() {
    if (hoverOverlay) {
      hoverOverlay.remove();
      hoverOverlay = null;
    }
  }

  function getStyles(el) {
    const styles = window.getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id,
      class: el.className,
      fontSize: styles.fontSize,
      color: styles.color,
      background: styles.backgroundColor,
      margin: styles.margin,
      padding: styles.padding,
      width: styles.width,
      height: styles.height,
    };
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START_INSPECT") {
      window.inspecting = true;
      createOverlay();
      document.body.style.cursor = "crosshair";
    }
  });

  document.addEventListener(
    "mousemove",
    (e) => {
      if (!window.inspecting || !hoverOverlay) return;
      const el = e.target;
      updateOverlay(el);
    },
    true
  );

  document.addEventListener(
    "click",
    (e) => {
      if (!window.inspecting) return;

      e.preventDefault();
      e.stopPropagation();

      const el = e.target;
      const data = getStyles(el);

      chrome.runtime.sendMessage({ type: "ELEMENT_DATA", payload: data });

      window.inspecting = false;
      document.body.style.cursor = "default";
      removeOverlay();
    },
    true
  );
}
