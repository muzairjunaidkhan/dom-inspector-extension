chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "ELEMENT_DATA") {
    chrome.runtime.sendMessage(msg);
  }
});
