/**
 * Compact pill + slide-in sidebar drawer for detected risks.
 *
 * Pill: ambient, single-row, non-blocking. "Review ▶" opens the sidebar.
 * Sidebar: glassmorphism drawer from the right edge. Per-risk redact + Redact All.
 */

import { redact, DISPLAY_LABELS } from '../utils/detectors/index.js';
import { getInputElement, setInputValue, getInputValue } from '../utils/input.js';
import { getContentEditableText, normalizeNewlines } from '../utils/rangeMapping.js';
import { clearPasteTargetElement } from '../state/scanState.js';
import { removeInlineSuggestions } from './overlay.js';

const PILL_ID = 'ai-guardrail-pill';
const SIDEBAR_ID = 'ai-guardrail-sidebar';

function getLiveText(inputEl) {
  if (!inputEl) return '';
  return (inputEl.isContentEditable || inputEl.getAttribute?.('contenteditable') === 'true')
    ? getContentEditableText(inputEl).text
    : normalizeNewlines(getInputValue(inputEl));
}

function resolveRisks(storedRisks, liveText, originalText) {
  if (liveText === originalText) return storedRisks;
  const resolved = [];
  for (const risk of storedRisks) {
    const idx = liveText.indexOf(risk.text);
    if (idx === -1) continue;
    resolved.push({ ...risk, start: idx, end: idx + risk.text.length });
  }
  return resolved;
}

function riskColor(riskLevel) {
  return riskLevel === 'HIGH' ? '#ef4444' : '#f59e0b';
}

export function showBodyPopup(scanId, fullRisks, fullText, _source, _filename, _detectionSource, targetElement, updateLog, onRescan) {
  document.getElementById(PILL_ID)?.remove();
  document.getElementById(SIDEBAR_ID)?.remove();

  const hasHigh = fullRisks.some(r => r.risk === 'HIGH');
  const typeList = [...new Set(fullRisks.map(r => DISPLAY_LABELS[r.type] || r.type))].join(', ');

  // ── Unified Styles ────────────────────────────────────────────────────────
  const CSS_RESET = 'outline: none !important; border: none; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);';

  // ── Pill (Mobile-first, Responsive) ───────────────────────────────────────
  const pill = document.createElement('div');
  pill.id = PILL_ID;
  pill.setAttribute('aria-hidden', 'true');
  pill.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 1000002;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    overflow: hidden;
    pointer-events: auto;
    max-width: min(420px, calc(100vw - 32px));
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), right 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
  `;

  const pillInner = document.createElement('div');
  pillInner.style.cssText = `
    background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
    color: white;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    user-select: none;
  `;

  const pillIcon = document.createElement('span');
  pillIcon.textContent = '🛡️';
  pillIcon.style.cssText = 'font-size: 16px; flex-shrink: 0;';

  const pillContent = document.createElement('div');
  pillContent.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-width: 0;';

  const pillMeta = document.createElement('div');
  pillMeta.style.cssText = 'display: flex; align-items: center; gap: 6px;';

  const pillCount = document.createElement('span');
  pillCount.id = 'ag-pill-count';
  pillCount.style.cssText = 'font-size: 13px; font-weight: 700;';

  const pillLevel = document.createElement('span');
  pillLevel.textContent = hasHigh ? 'HIGH RISK' : 'RISK';
  pillLevel.style.cssText = `
    font-size: 10px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 100px;
    background: ${hasHigh ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)'};
    color: white;
    letter-spacing: 0.05em;
  `;

  pillMeta.append(pillCount, pillLevel);

  const pillTypes = document.createElement('span');
  pillTypes.title = typeList;
  pillTypes.textContent = typeList;
  pillTypes.style.cssText = 'font-size: 11px; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;';

  pillContent.append(pillMeta, pillTypes);

  function updatePillCount(n) {
    pillCount.textContent = `${n} Risk${n !== 1 ? 's' : ''}`;
  }
  updatePillCount(fullRisks.length);

  const pillReview = document.createElement('button');
  pillReview.id = 'ag-pill-review';
  pillReview.textContent = 'Review ▶';
  pillReview.style.cssText = `
    ${CSS_RESET}
    background: rgba(255,255,255,0.2);
    color: white;
    border: 1px solid rgba(255,255,255,0.1);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
  `;
  pillReview.onmouseover = () => { pillReview.style.background = 'rgba(255,255,255,0.3)'; };
  pillReview.onmouseout = () => { pillReview.style.background = 'rgba(255,255,255,0.2)'; };

  const pillDismiss = document.createElement('button');
  pillDismiss.id = 'ag-pill-dismiss';
  pillDismiss.textContent = '✕';
  pillDismiss.style.cssText = `
    ${CSS_RESET}
    background: transparent;
    color: rgba(255,255,255,0.7);
    padding: 8px;
    font-size: 18px;
    font-weight: 300;
    line-height: 1;
  `;
  pillDismiss.onmouseover = () => { pillDismiss.style.color = '#fff'; };
  pillDismiss.onmouseout = () => { pillDismiss.style.color = 'rgba(255,255,255,0.7)'; };

  pillInner.append(pillIcon, pillContent, pillReview, pillDismiss);
  pill.appendChild(pillInner);
  document.body.appendChild(pill);

  // ── Sidebar (The Drawer) ───────────────────────────────────────────────
  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  sidebar.setAttribute('aria-hidden', 'true');
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 340px;
    max-width: 95vw;
    height: 100vh;
    z-index: 1000001;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: -10px 0 40px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    transform: translateX(105%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    border-left: 1px solid rgba(255,255,255,0.1);
  `;

  // Sidebar header
  const sidebarHeader = document.createElement('div');
  sidebarHeader.style.cssText = `
    padding: 24px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
  `;

  const sidebarHeaderTop = document.createElement('div');
  sidebarHeaderTop.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';

  const sidebarTitle = document.createElement('span');
  sidebarTitle.style.cssText = 'color: white; font-size: 16px; font-weight: 700;';
  sidebarTitle.textContent = 'Detected Risks';

  const sidebarClose = document.createElement('button');
  sidebarClose.textContent = '✕';
  sidebarClose.style.cssText = `
    ${CSS_RESET}
    background: rgba(255,255,255,0.1);
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  sidebarClose.onclick = () => closeSidebar();

  sidebarHeaderTop.append(sidebarTitle, sidebarClose);

  const sidebarActions = document.createElement('div');
  sidebarActions.style.cssText = 'display: flex; gap: 8px;';

  const sidebarRedactAll = document.createElement('button');
  sidebarRedactAll.id = 'ag-sidebar-redact-all';
  sidebarRedactAll.textContent = 'Redact All Risks';
  sidebarRedactAll.style.cssText = `
    ${CSS_RESET}
    background: #10b981;
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    flex: 1;
  `;
  sidebarRedactAll.onmouseover = () => { sidebarRedactAll.style.background = '#059669'; };
  sidebarRedactAll.onmouseout = () => { sidebarRedactAll.style.background = '#10b981'; };

  sidebarActions.appendChild(sidebarRedactAll);
  sidebarHeader.append(sidebarHeaderTop, sidebarActions);

  const sidebarList = document.createElement('div');
  sidebarList.id = 'ag-sidebar-list';
  sidebarList.style.cssText = 'flex: 1; overflow-y: auto; overflow-x: hidden; padding: 0 12px 24px;';

  sidebar.append(sidebarHeader, sidebarList);
  document.body.appendChild(sidebar);

  // ── Build risk rows ───────────────────────────────────────────────────────
  let activeRisks = [...fullRisks];

  function buildRows(risks) {
    sidebarList.replaceChildren();
    risks.forEach((risk, i) => {
      const label = DISPLAY_LABELS[risk.type] || risk.type;
      const previewText = risk.text?.length > 40 ? risk.text.slice(0, 40) + '…' : (risk.text || '');
      const color = riskColor(risk.risk);

      const row = document.createElement('div');
      row.dataset.riskIndex = String(i);
      row.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 10px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        transition: transform 0.15s ease, background 0.15s ease;
      `;

      const rowTop = document.createElement('div');
      rowTop.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';

      const typeBox = document.createElement('div');
      typeBox.style.cssText = 'display: flex; align-items: center; gap: 6px;';

      const dot = document.createElement('span');
      dot.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background: ${color};`;

      const typeLabel = document.createElement('span');
      typeLabel.textContent = label;
      typeLabel.style.cssText = `font-size: 10px; font-weight: 800; color: ${color}; text-transform: uppercase; letter-spacing: 0.05em;`;

      typeBox.append(dot, typeLabel);

      const redactBtn = document.createElement('button');
      redactBtn.className = 'ag-redact-one';
      redactBtn.textContent = 'Redact';
      redactBtn.style.cssText = `
        ${CSS_RESET}
        background: rgba(16,185,129,0.12);
        color: #10b981;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid rgba(16,185,129,0.2);
      `;
      redactBtn.onmouseover = () => {
        redactBtn.style.background = 'rgba(16,185,129,0.2)';
        redactBtn.style.borderColor = 'rgba(16,185,129,0.4)';
      };
      redactBtn.onmouseout = () => {
        redactBtn.style.background = 'rgba(16,185,129,0.12)';
        redactBtn.style.borderColor = 'rgba(16,185,129,0.2)';
      };

      rowTop.append(typeBox, redactBtn);

      const preview = document.createElement('div');
      preview.textContent = previewText;
      preview.title = risk.text || '';
      preview.style.cssText = `
        font-size: 12px;
        color: rgba(255,255,255,0.7);
        font-family: ui-monospace, 'Cascadia Code', monospace;
        word-break: break-all;
        line-height: 1.4;
      `;

      row.append(rowTop, preview);
      sidebarList.appendChild(row);
    });
  }

  buildRows(activeRisks);

  // ── Auto-dismiss & Visibility ─────────────────────────────────────────────
  const DISMISS_MS = 15000;
  let dismissTimer = null;
  let sidebarOpen = false;

  // Exported for internal use
  window.__ag_close_all = (action = 'dismiss') => {
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    clearPasteTargetElement();
    if (document.body.contains(pill)) pill.remove();
    if (document.body.contains(sidebar)) sidebar.remove();
    
    if (action !== 'dismiss') {
      removeInlineSuggestions();
    }
    
    if (updateLog) updateLog(scanId, action).catch(() => {});
  };

  function closeAll(action = 'dismiss') {
    window.__ag_close_all(action);
  }

  function scheduleDismiss() {
    if (sidebarOpen) return;
    if (dismissTimer) clearTimeout(dismissTimer);
    if (document.visibilityState !== 'visible') return;
    dismissTimer = setTimeout(() => closeAll('dismiss'), DISMISS_MS);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') scheduleDismiss();
    else if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  scheduleDismiss();

  // ── Sidebar open/close (Docking Logic) ────────────────────────────────────
  function openSidebar() {
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
    sidebarOpen = true;
    sidebar.style.transform = 'translateX(0)';

    // DOCKING: Align pill with sidebar edge
    const sidebarWidth = sidebar.getBoundingClientRect().width || 340;
    pill.style.right = `${sidebarWidth + 16}px`;
    pillReview.textContent = '◀ Hide';
    pill.style.boxShadow = 'none'; // Thinner profile when docked
  }

  function closeSidebar() {
    sidebarOpen = false;
    sidebar.style.transform = 'translateX(105%)';

    // RESET: Back to corner
    pill.style.right = '16px';
    pillReview.textContent = 'Review ▶';
    pill.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
    scheduleDismiss();
  }

  pillReview.onclick = () => {
    if (sidebarOpen) closeSidebar();
    else openSidebar();
  };

  pillDismiss.onclick = () => closeAll('dismiss');

  // ── Redact All ────────────────────────────────────────────────────────────
  sidebarRedactAll.onclick = () => {
    const inputEl = (targetElement && document.body.contains(targetElement)) ? targetElement : getInputElement();
    if (!inputEl) return;

    const liveText = getLiveText(inputEl);
    const resolved = resolveRisks(activeRisks, liveText, fullText);
    const redactedText = redact(liveText, resolved);

    setInputValue(inputEl, redactedText);
    navigator.clipboard.writeText(redactedText).catch(() => {});
    closeAll('fix');
  };

  // ── Individual Redact ─────────────────────────────────────────────────────
  sidebarList.onclick = (e) => {
    const btn = e.target.closest('.ag-redact-one');
    if (!btn) return;
    const row = btn.closest('[data-risk-index]');
    if (!row) return;

    const idx = parseInt(row.dataset.riskIndex, 10);
    const risk = activeRisks[idx];
    if (!risk) return;

    const inputEl = (targetElement && document.body.contains(targetElement)) ? targetElement : getInputElement();
    if (!inputEl) return;

    const liveText = getLiveText(inputEl);
    let resolvedRisk = risk;
    if (liveText.slice(risk.start, risk.end) !== risk.text) {
      const newStart = liveText.indexOf(risk.text);
      if (newStart === -1) {
        row.style.opacity = '0';
        setTimeout(() => {
          row.remove();
          activeRisks = activeRisks.filter((_, i) => i !== idx);
          updatePillCount(activeRisks.length);
        }, 150);
        return;
      }
      resolvedRisk = { ...risk, start: newStart, end: newStart + risk.text.length };
    }

    const redactedText = redact(liveText, [resolvedRisk]);
    setInputValue(inputEl, redactedText);

    row.style.transform = 'translateX(20px)';
    row.style.opacity = '0';

    setTimeout(() => {
      row.remove();
      activeRisks = activeRisks.filter((_, i) => i !== idx);
      // Re-index remaining rows
      sidebarList.querySelectorAll('[data-risk-index]').forEach((r, i) => {
        r.dataset.riskIndex = String(i);
      });

      if (activeRisks.length === 0) {
        closeAll('fix');
        return;
      }

      updatePillCount(activeRisks.length);
      if (onRescan) onRescan(redactedText);
    }, 150);
  };
}

export function removeBodyPopup() {
  if (typeof window.__ag_close_all === 'function') {
    window.__ag_close_all('dismiss');
  }
}
