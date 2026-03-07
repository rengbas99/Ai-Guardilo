/**
 * Background Service Worker
 * Handles extension lifecycle and storage management
 */

const MAX_LOG_ENTRIES = 500;

async function appendRiskLog(entry) {
  const { riskLogs = [] } = await chrome.storage.local.get('riskLogs');
  const riskLog = Array.isArray(riskLogs) ? riskLogs : [];
  riskLog.unshift({ ...entry, ts: entry.timestamp || entry.ts || Date.now() });
  const capped = riskLog.slice(0, MAX_LOG_ENTRIES);
  try {
    await chrome.storage.local.set({ riskLogs: capped });
  } catch (err) {
    if (err?.message?.includes('QUOTA_BYTES')) {
      await chrome.storage.local.set({ riskLogs: [entry] });
    }
  }
}

async function updateRiskLogAction(scanId, userAction) {
  const { riskLogs = [] } = await chrome.storage.local.get('riskLogs');
  const log = riskLogs.find((e) => e.scanId === scanId);
  if (log) {
    log.userAction = userAction;
    log.actionTimestamp = Date.now();
    await chrome.storage.local.set({ riskLogs: riskLogs.slice(0, MAX_LOG_ENTRIES) });
  }
}

// Extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Initialize storage
    chrome.storage.local.set({
      riskLogs: [],
      stats: {
        total: 0,
        domains: {},
        highRisk: 0,
        mediumRisk: 0,
        safeContexts: 0
      },
      settings: {
        enabled: true,
      },
    });
  }
});

// Queue for serializing stats updates
const pendingStatsUpdates = [];
let isProcessingStats = false;

// Process next stats update from queue
function processNextStatsUpdate() {
  if (isProcessingStats || pendingStatsUpdates.length === 0) {
    return;
  }
  
  isProcessingStats = true;
  const message = pendingStatsUpdates.shift();
  
  chrome.storage.local.get(['stats'], (data) => {
    const stats = data.stats || {
      total: 0,
      domains: {},
      highRisk: 0,
      mediumRisk: 0,
      safeContexts: 0
    };
    
    stats.total += message.risksFound || 0;
    stats.highRisk += message.highRisk || 0;
    stats.mediumRisk += message.mediumRisk || 0;
    
    const domain = message.domain || 'unknown';
    if (!stats.domains[domain]) {
      stats.domains[domain] = 0;
    }
    stats.domains[domain] += message.risksFound || 0;
    
    chrome.storage.local.set({ stats }, () => {
      if (message.sendResponse) {
        message.sendResponse({ success: true });
      }
      isProcessingStats = false;
      // Process next item in queue
      processNextStatsUpdate();
    });
  });
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOGS') {
    chrome.storage.local.get(['riskLogs'], (result) => {
      sendResponse({ logs: result.riskLogs || [] });
    });
    return true; // Async response
  }

  if (message.type === 'LOG_RISK') {
    appendRiskLog(message.entry || {}).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'UPDATE_LOG') {
    updateRiskLogAction(message.scanId, message.userAction).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  
  if (message.type === 'CLEAR_LOGS') {
    chrome.storage.local.set({ riskLogs: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'DETECTION_FALLBACK') {
    // Non-blocking telemetry: AI failed, regex was used
    return false; // no async response
  }

  if (message.type === 'STATS_UPDATE') {
    // Queue the update with sendResponse callback
    pendingStatsUpdates.push({ ...message, sendResponse });
    // Start processing if idle
    processNextStatsUpdate();
    return true; // Async response
  }
  
  if (message.type === 'GET_STATS') {
    chrome.storage.local.get(['stats'], (result) => {
      sendResponse({ stats: result.stats || {
        total: 0,
        domains: {},
        highRisk: 0,
        mediumRisk: 0,
        safeContexts: 0
      }});
    });
    return true;
  }

});

