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

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "dom-inspector",
    title: "DOM Inspector",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "inspect-element",
    parentId: "dom-inspector",
    title: "Inspect Element",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "outline-all",
    parentId: "dom-inspector",
    title: "Outline All Elements",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "measure-distance",
    parentId: "dom-inspector",
    title: "Measure Distance",
    contexts: ["all"]
  });

  chrome.contextMenus.create({
    id: "responsive-mode",
    parentId: "dom-inspector",
    title: "Responsive Mode",
    contexts: ["all"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "inspect-element") {
    chrome.tabs.sendMessage(tab.id, { type: "START_INSPECT" });
  } else if (info.menuItemId === "outline-all") {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OUTLINE" });
  } else if (info.menuItemId === "measure-distance") {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_RULER" });
  } else if (info.menuItemId === "responsive-mode") {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_RESPONSIVE" });
  }
});