console.log("BACKGROUND: Script loaded and running!");

// 1. Force Side Panel on Click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("BACKGROUND: Failed to set panel behavior:", error));

// 2. Add a manual listener for debugging
chrome.action.onClicked.addListener((tab) => {
  console.log("BACKGROUND: Icon clicked!");
  chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId })
    .then(() => console.log("BACKGROUND: Side panel opened successfully"))
    .catch((err) => console.error("BACKGROUND: Error opening panel:", err));
});