// Background Service Worker for TabDock Extension

// Init storage on installation (preserve existing checkpoints if present)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.get(["checkpoints"], (data) => {
      if (!data.checkpoints) {
        chrome.storage.local.set({ checkpoints: [] }, () => {
          console.log("TabDock Extension initialized.");
        });
      }
    });
  }
});

// Listener for custom actions (e.g. keyboard shortcuts or background window operations)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "restoreInstance") {
    const { urls } = message;
    if (urls && urls.length > 0) {
      chrome.windows.create({ url: urls, focused: true }, (newWindow) => {
        sendResponse({ success: true, windowId: newWindow.id });
      });
      return true; // Keep message channel open for async response
    } else {
      sendResponse({ success: false, error: "No URLs provided" });
    }
  }
});
