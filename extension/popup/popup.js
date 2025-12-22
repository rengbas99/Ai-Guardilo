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
    const result = await chrome.storage.local.get(['riskLogs']);
    const logs = result.riskLogs || [];
    
    const todayStart = getTodayStart();
    const todayCount = logs.filter(log => log.timestamp >= todayStart).length;
    const totalCount = logs.length;
    
    document.getElementById('today-count').textContent = todayCount;
    document.getElementById('total-count').textContent = totalCount;
    
    // Display recent risks (last 10)
    displayRecentRisks(logs.slice(-10).reverse());
  } catch (error) {
    console.error('AI Guardrail: Failed to load stats', error);
  }
}

// Display recent risks list
function displayRecentRisks(risks) {
  const listEl = document.getElementById('risks-list');
  
  if (risks.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No risks detected yet</p>';
    return;
  }
  
  listEl.innerHTML = risks.map(risk => {
    const riskTypes = [...new Set(risk.risks.map(r => r.type))].join(', ');
    const source = risk.filename || risk.source;
    const action = risk.userAction ? ` • ${risk.userAction}` : '';
    
    return `
      <div class="risk-item">
        <div class="risk-item-header">
          <span class="risk-types">${risk.risks.length} risk${risk.risks.length > 1 ? 's' : ''}</span>
          <span class="risk-time">${formatDate(risk.timestamp)}${action}</span>
        </div>
        <div class="risk-source">${source}</div>
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
  } catch (error) {
    console.error('AI Guardrail: Failed to export CSV', error);
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
  } catch (error) {
    console.error('AI Guardrail: Failed to clear logs', error);
    alert('Failed to clear logs. Please try again.');
  }
}

// Event listeners
document.getElementById('export-btn').addEventListener('click', exportDSAR);
document.getElementById('clear-btn').addEventListener('click', clearLogs);

// Load stats on popup open
loadStats();

