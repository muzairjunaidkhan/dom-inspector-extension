import { useEffect, useState } from "react";

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (chrome.runtime) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "ELEMENT_DATA") {
          setData(msg.payload);
        }
      });
    }
  }, []);

  const inspectElement = async () => {
    if (!chrome.tabs) {
      alert("Chrome API not available. Test in extension only.");
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    chrome.tabs.sendMessage(tab.id, { type: "START_INSPECT" });
  };

  return (
    <div style={{ padding: 16, width: 280 }}>
      <h3>DOM Inspector</h3>
      <button onClick={inspectElement}>Inspect Element</button>

      {data && (
        <pre style={{ marginTop: 10 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default App;
