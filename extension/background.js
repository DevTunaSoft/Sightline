'use strict';
// Opening the extension action explicitly grants activeTab to the currently active tab.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Could not set side-panel action behavior:', error));
