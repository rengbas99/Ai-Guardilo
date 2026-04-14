/**
 * Popup Dashboard Script
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const el = document.getElementById('status-msg');
  if (!el) return;
  el.textContent = message;
  el.className = `toast toast-${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

function formatDate(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function severityOf(risk) {
  if (risk.confidence >= 0.85) return 'high';
  if (risk.confidence >= 0.6)  return 'medium';
  return 'low';
}

function logSeverity(log) {
  return log.risks?.some(r => r.confidence >= 0.85) ? 'high' : 'medium';
}

// Mask the middle of a string for display
function maskSnippet(text = '') {
  if (text.length <= 6) return text.replace(/./g, '*');
  return text.slice(0, 2) + '•••' + text.slice(-2);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function buildRiskItem(log) {
  const sev   = logSeverity(log);
  const types = [...new Set(log.risks.map(r => r.type))];

  const item = document.createElement('div');
  item.className = 'risk-item';

  // Severity bar
  const bar = document.createElement('div');
  bar.className = `risk-bar ${sev}`;
  item.appendChild(bar);

  // Body
  const body = document.createElement('div');
  body.className = 'risk-body';

  // Top row: badge + type tags + time
  const top = document.createElement('div');
  top.className = 'risk-top';

  const badge = document.createElement('span');
  badge.className = `sev-badge ${sev}`;
  badge.textContent = sev.toUpperCase();
  top.appendChild(badge);

  const typeTags = document.createElement('div');
  typeTags.className = 'risk-type-tags';
  for (const t of types.slice(0, 4)) {
    const tag = document.createElement('span');
    tag.className = 'type-tag';
    tag.textContent = t.replace(/_/g, ' ');
    typeTags.appendChild(tag);
  }
  if (types.length > 4) {
    const more = document.createElement('span');
    more.className = 'type-tag';
    more.textContent = `+${types.length - 4}`;
    typeTags.appendChild(more);
  }
  top.appendChild(typeTags);

  const time = document.createElement('span');
  time.className = 'risk-time';
  time.textContent = formatDate(log.timestamp);
  top.appendChild(time);

  // Snippet — show masked value of first risk, or count
  const snippet = document.createElement('div');
  snippet.className = 'risk-snippet';
  const firstRisk = log.risks[0];
  if (firstRisk?.value) {
    const label = firstRisk.type.replace(/_/g, ' ');
    snippet.textContent = `${label}: ${maskSnippet(firstRisk.value)}`;
  } else {
    snippet.textContent = `${log.risks.length} item${log.risks.length !== 1 ? 's' : ''} detected`;
  }

  // Source
  const source = document.createElement('div');
  source.className = 'risk-source';
  source.textContent = log.filename || log.source || '—';

  body.appendChild(top);
  body.appendChild(snippet);
  body.appendChild(source);
  item.appendChild(body);
  return item;
}

function renderRiskList(logs, highOnly) {
  const list = document.getElementById('risks-list');
  const filtered = highOnly
    ? logs.filter(l => l.risks?.some(r => r.confidence >= 0.85))
    : logs;

  list.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <span class="empty-icon">🛡️</span>
      <span class="empty-title">No risks detected yet</span>
      <span class="empty-hint">Start typing in a supported AI chat</span>
    `;
    list.appendChild(empty);
    return;
  }

  for (const log of filtered) {
    list.appendChild(buildRiskItem(log));
  }
}

// ─── Load stats ───────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['riskLogs', 'stats']);
    const logs   = result.riskLogs || [];
    const stats  = result.stats   || { total: 0, highRisk: 0, mediumRisk: 0, safeContexts: 0 };

    document.getElementById('high-risk').textContent   = stats.highRisk   || 0;
    document.getElementById('medium-risk').textContent = stats.mediumRisk || 0;
    document.getElementById('total-count').textContent = stats.total      || 0;

    const highOnly = document.getElementById('high-only')?.checked ?? false;
    renderRiskList(logs.slice(-20).reverse(), highOnly);
  } catch (_) {}
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function exportDSAR() {
  try {
    const { riskLogs: logs = [] } = await chrome.storage.local.get('riskLogs');

    if (logs.length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const headers = ['Timestamp', 'Scan ID', 'Risk Count', 'Risk Types', 'Source', 'Filename', 'User Action', 'Action Timestamp'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.scanId,
      log.risks.length,
      [...new Set(log.risks.map(r => r.type))].join('; '),
      log.source,
      log.filename || '',
      log.userAction || '',
      log.actionTimestamp ? new Date(log.actionTimestamp).toISOString() : '',
    ].map(f => `"${String(f).replace(/"/g, '""')}"`).join(','));

    const csv  = [headers.join(','), ...rows].join('\n');
    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = Object.assign(document.createElement('a'), {
      href: url,
      download: `ai-guardrail-${new Date().toISOString().split('T')[0]}.csv`,
    });
    link.click();
    URL.revokeObjectURL(url);
    showToast('Export complete ✓');
  } catch (_) {
    showToast('Export failed', 'error');
  }
}

// ─── Clear logs ───────────────────────────────────────────────────────────────

function showConfirm() {
  document.getElementById('confirm-bar').hidden = false;
  document.getElementById('clear-btn').disabled = true;
}

function hideConfirm() {
  document.getElementById('confirm-bar').hidden = true;
  document.getElementById('clear-btn').disabled = false;
}

async function clearLogs() {
  hideConfirm();
  try {
    await chrome.storage.local.set({ riskLogs: [], stats: { total: 0, highRisk: 0, mediumRisk: 0, safeContexts: 0 } });
    await loadStats();
    showToast('All logs cleared');
  } catch (_) {
    showToast('Failed to clear logs', 'error');
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById('export-btn').addEventListener('click', exportDSAR);
document.getElementById('clear-btn').addEventListener('click', showConfirm);
document.getElementById('confirm-yes').addEventListener('click', clearLogs);
document.getElementById('confirm-no').addEventListener('click', hideConfirm);
document.getElementById('high-only').addEventListener('change', loadStats);

// ─── Init ─────────────────────────────────────────────────────────────────────

loadStats();
