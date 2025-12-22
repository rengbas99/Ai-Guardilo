/**
 * Background Service Worker
 * Handles extension lifecycle and storage management
 */

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Initialize storage
    chrome.storage.local.set({
      riskLogs: [],
      settings: {
        enabled: true,
      },
    });
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOGS') {
    chrome.storage.local.get(['riskLogs'], (result) => {
      sendResponse({ logs: result.riskLogs || [] });
    });
    return true; // Async response
  }
  
  if (message.type === 'CLEAR_LOGS') {
    chrome.storage.local.set({ riskLogs: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

