import { useEffect } from "react";

export default function App() {
  const startInspect = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    chrome.tabs.sendMessage(tab.id, { type: "START_INSPECT" });
  };

  const clearOverlay = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: "CLEAR_OVERLAY" });
  };


  return (
    <div style={{ padding: 16, width: 200 }}>
      <button onClick={startInspect} style={{ marginBottom: 8 }}>Start Inspect</button>
      <button onClick={clearOverlay}>Clear Overlay</button>
    </div>
  );
}
