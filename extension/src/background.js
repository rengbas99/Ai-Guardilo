/**
 * Background Service Worker
 * Handles extension lifecycle and storage management
 */

const MAX_LOG_ENTRIES = 500;

async function appendRiskLog(entry) {
  const { riskLogs = [] } = await chrome.storage.local.get('riskLogs');
  const log = Array.isArray(riskLogs) ? riskLogs : [];
  log.unshift({ ...entry, ts: entry.timestamp || entry.ts || Date.now() });
  const capped = log.slice(0, MAX_LOG_ENTRIES);
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
  const entry = riskLogs.find(e => e.scanId === scanId);
  if (entry) {
    entry.userAction = userAction;
    entry.actionTimestamp = Date.now();
    await chrome.storage.local.set({ riskLogs: riskLogs.slice(0, MAX_LOG_ENTRIES) });
  }
}

// Initialize storage on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      riskLogs: [],
      stats: { total: 0, domains: {}, highRisk: 0, mediumRisk: 0, safeContexts: 0 },
      settings: { enabled: true },
    });
  }
});

// Serialized stats update queue — prevents concurrent read-modify-write races
const pendingStatsUpdates = [];
let isProcessingStats = false;

async function processNextStatsUpdate() {
  if (isProcessingStats || pendingStatsUpdates.length === 0) return;

  isProcessingStats = true;
  const message = pendingStatsUpdates.shift();

  try {
    const data = await chrome.storage.local.get('stats');
    const stats = data.stats || { total: 0, domains: {}, highRisk: 0, mediumRisk: 0, safeContexts: 0 };

    stats.total += message.risksFound || 0;
    stats.highRisk += message.highRisk || 0;
    stats.mediumRisk += message.mediumRisk || 0;

    const domain = message.domain || 'unknown';
    stats.domains[domain] = (stats.domains[domain] || 0) + (message.risksFound || 0);

    await chrome.storage.local.set({ stats });
    message.sendResponse?.({ success: true });
  } catch (_) {
    message.sendResponse?.({ success: false });
  } finally {
    isProcessingStats = false;
    processNextStatsUpdate();
  }
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOGS') {
    chrome.storage.local.get('riskLogs').then(result => {
      sendResponse({ logs: result.riskLogs || [] });
    });
    return true;
  }

  if (message.type === 'LOG_RISK') {
    appendRiskLog(message.entry || {})
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'UPDATE_LOG') {
    updateRiskLogAction(message.scanId, message.userAction)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'CLEAR_LOGS') {
    chrome.storage.local.set({ riskLogs: [] }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'STATS_UPDATE') {
    pendingStatsUpdates.push({ ...message, sendResponse });
    processNextStatsUpdate();
    return true;
  }

  if (message.type === 'GET_STATS') {
    chrome.storage.local.get('stats').then(result => {
      sendResponse({ stats: result.stats || { total: 0, domains: {}, highRisk: 0, mediumRisk: 0, safeContexts: 0 } });
    });
    return true;
  }

  return false;
});
