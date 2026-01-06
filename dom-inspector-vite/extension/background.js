// Store the last inspected element
let lastElementData = null;

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ELEMENT_DATA") {
    // Save data from content script
    lastElementData = msg.payload;
  }

  if (msg.type === "GET_LAST_ELEMENT") {
    // Popup asks for last element
    sendResponse({ data: lastElementData });
  }

  // Return true if you plan to respond asynchronously
  return true;
});
