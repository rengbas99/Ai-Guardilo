/**
 * Popup Dashboard Script
 * Displays stats and recent risks, handles DSAR export
 */

// Get today's timestamp (start of day)
function getTodayStart() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

// Format timestamp to readable date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

// Load and display stats
async function loadStats() {
  try {
    // Load both risk logs and stats
    const result = await chrome.storage.local.get(['riskLogs', 'stats']);
    const logs = result.riskLogs || [];
    const stats = result.stats || {
      total: 0,
      domains: {},
      highRisk: 0,
      mediumRisk: 0,
      safeContexts: 0
    };
    
    // Update stat cards
    document.getElementById('high-risk').textContent = stats.highRisk || 0;
    document.getElementById('total-count').textContent = stats.total || 0;
    document.getElementById('medium-risk').textContent = stats.mediumRisk || 0;
    document.getElementById('safe-contexts').textContent = stats.safeContexts || 0;
    
    // Display recent risks (last 10)
    const highOnlyFilter = document.getElementById('high-only')?.checked || false;
    displayRecentRisks(logs.slice(-10).reverse(), highOnlyFilter);
  } catch (_) {}
}

// Display recent risks list
function displayRecentRisks(risks, highOnly = false) {
  const listEl = document.getElementById('risks-list');
  
  // Filter by high risk if toggle is on
  let filteredRisks = risks;
  if (highOnly) {
    filteredRisks = risks.filter(r => {
      return r.risks && r.risks.some(risk => risk.confidence >= 0.95);
    });
  }
  
  if (filteredRisks.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No risks detected yet</p>';
    return;
  }
  
  listEl.innerHTML = filteredRisks.map(risk => {
    const riskTypes = [...new Set(risk.risks.map(r => r.type))].join(', ');
    const source = risk.filename || risk.source;
    const action = risk.userAction ? ` • ${risk.userAction}` : '';
    const hasHighRisk = risk.risks.some(r => r.confidence >= 0.95);
    const riskBadge = hasHighRisk ? '<span style="background: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;">HIGH</span>' : '';
    
    return `
      <div class="risk-item">
        <div class="risk-item-header">
          <span class="risk-types">${risk.risks.length} risk${risk.risks.length > 1 ? 's' : ''} ${riskBadge}</span>
          <span class="risk-time">${formatDate(risk.timestamp)}${action}</span>
        </div>
        <div class="risk-source">${source}</div>
        <div class="risk-types-list" style="font-size: 11px; color: #6b7280; margin-top: 4px;">${riskTypes}</div>
      </div>
    `;
  }).join('');
}

// Export DSAR CSV
async function exportDSAR() {
  try {
    const result = await chrome.storage.local.get(['riskLogs']);
    const logs = result.riskLogs || [];
    
    if (logs.length === 0) {
      alert('No data to export');
      return;
    }
    
    // CSV headers
    const headers = ['Timestamp', 'Scan ID', 'Risk Count', 'Risk Types', 'Source', 'Filename', 'User Action', 'Action Timestamp'];
    
    // CSV rows
    const rows = logs.map(log => {
      const riskTypes = [...new Set(log.risks.map(r => r.type))].join('; ');
      const date = new Date(log.timestamp).toISOString();
      const actionDate = log.actionTimestamp ? new Date(log.actionTimestamp).toISOString() : '';
      
      return [
        date,
        log.scanId,
        log.risks.length,
        riskTypes,
        log.source,
        log.filename || '',
        log.userAction || '',
        actionDate,
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    
    // Combine
    const csv = [headers.join(','), ...rows].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-guardrail-dsar-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (_) {
    alert('Failed to export CSV. Please try again.');
  }
}

// Clear logs
async function clearLogs() {
  if (!confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.local.set({ riskLogs: [] });
    loadStats(); // Refresh display
  } catch (_) {
    alert('Failed to clear logs. Please try again.');
  }
}

// Event listeners
document.getElementById('export-btn').addEventListener('click', exportDSAR);
document.getElementById('clear-btn').addEventListener('click', clearLogs);

// High risk only toggle
const highOnlyToggle = document.getElementById('high-only');
if (highOnlyToggle) {
  highOnlyToggle.addEventListener('change', () => {
    loadStats(); // Reload with filter
  });
}

// Load stats on popup open
loadStats();

