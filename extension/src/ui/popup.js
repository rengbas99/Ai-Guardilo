/**
 * Top-right floating popup (Update / Ignore)
 */

import { getPlaceholder, redact, DISPLAY_LABELS } from '../utils/detectors/index.js';
import { getInputElement, setInputValue, getInputValue } from '../utils/input.js';
import { getContentEditableText, normalizeNewlines } from '../utils/rangeMapping.js';
import { clearPasteTargetElement } from '../state/scanState.js';
import { removeInlineSuggestions } from './overlay.js';

function buildPreviewHTML(fullText, fullRisks) {
  // Assign indices by position (first in text = 1, second = 2, etc.)
  const byPosition = [...fullRisks].sort((a, b) => a.start - b.start);
  const counters = {};
  const indexMap = new Map();
  for (const risk of byPosition) {
    counters[risk.type] = (counters[risk.type] || 0) + 1;
    indexMap.set(risk, getPlaceholder(risk.type, counters[risk.type]));
  }
  // Build preview in reverse order so indices stay valid
  const sortedRisks = [...fullRisks].sort((a, b) => b.start - a.start);
  let preview = fullText;
  for (const risk of sortedRisks) {
    const placeholder = indexMap.get(risk);
    const highlighted = `<mark style="background: #fef3c7; color: #92400e; padding: 2px 4px; border-radius: 3px; font-weight: 600;">${risk.text}</mark>`;
    const replacement = `<span style="background: #d1fae5; color: #065f46; padding: 2px 4px; border-radius: 3px; font-weight: 600;">${placeholder}</span>`;
    preview = preview.substring(0, risk.start) + highlighted + ' → ' + replacement + preview.substring(risk.end);
  }
  return preview;
}

export function showBodyPopup(scanId, fullRisks, fullText, source, filename, detectionSource, targetElement, updateLog) {
  const existing = document.getElementById('ai-guardrail-pill');
  if (existing) existing.remove();

  const redacted = redact(fullText, fullRisks);
  const previewHTML = buildPreviewHTML(fullText, fullRisks);
  const sourceLabel = detectionSource === 'local' ? 'AI' : 'Local';

  const pill = document.createElement('div');
  pill.id = 'ai-guardrail-pill';
  pill.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: min(500px, calc(100vw - 40px));
    max-height: calc(100vh - 40px);
    overflow: hidden;
    z-index: 1000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
  `;
  pill.innerHTML = `
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 16px 20px; border-radius: 12px 12px 0 0; flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="font-size: 20px;">⚠️</span>
        <strong style="font-size: 16px;">${fullRisks.length} risk${fullRisks.length > 1 ? 's' : ''} detected</strong>
        ${fullRisks.some(r => r.risk === 'HIGH') ? '<span style="background: rgba(0,0,0,0.2); color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">HIGH RISK</span>' : ''}
      </div>
      <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">From ${filename ? `"${filename.length > 30 ? filename.substring(0, 30) + '...' : filename}"` : source}</div>
      <div style="font-size: 11px; opacity: 0.8;">Types: ${[...new Set(fullRisks.map(r => DISPLAY_LABELS[r.type] ?? r.type))].join(', ')} · ${sourceLabel}</div>
    </div>
    <div style="background: white; color: #111827; padding: 12px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; overflow-y: auto; flex: 1; min-height: 0;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">Preview Changes:</div>
      <div style="font-size: 12px; line-height: 1.6; color: #6b7280; word-wrap: break-word; margin-bottom: 12px;">${previewHTML}</div>
      <div style="display: flex; gap: 8px;">
        <button id="ai-guardrail-pill-update" style="flex: 1; background: #10b981; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;">✓ Update</button>
        <button id="ai-guardrail-pill-ignore" style="flex: 1; background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;">Ignore</button>
      </div>
    </div>
  `;

  document.body.appendChild(pill);
  pill.dataset.scanId = scanId;
  pill.dataset.content = fullText;
  pill.dataset.redacted = redacted;
  pill.dataset.risks = JSON.stringify(fullRisks);

  // Auto-dismiss only while tab is visible (pause when minimized or tab in background)
  const DISMISS_MS = 15000;
  let dismissTimer = null;

  function closePill() {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (document.body.contains(pill)) {
      clearPasteTargetElement();
      if (updateLog) updateLog(scanId, 'dismiss').catch(() => {});
      pill.remove();
      removeInlineSuggestions();
    }
  }

  function scheduleDismiss() {
    if (dismissTimer) clearTimeout(dismissTimer);
    if (document.visibilityState !== 'visible') return;
    dismissTimer = setTimeout(() => {
      dismissTimer = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (document.body.contains(pill)) {
        clearPasteTargetElement();
        if (updateLog) updateLog(scanId, 'dismiss').catch(() => {});
        pill.remove();
        removeInlineSuggestions();
      }
    }, DISMISS_MS);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      scheduleDismiss(); // resume 15s when user returns to tab
    } else {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  scheduleDismiss();

  pill.querySelector('#ai-guardrail-pill-update').addEventListener('click', () => {
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    const inputEl = (targetElement && document.body.contains(targetElement)) ? targetElement : getInputElement();
    if (!inputEl) return;

    // Re-read live text at click time
    const liveText = inputEl.isContentEditable || inputEl.getAttribute('contenteditable') === 'true'
      ? getContentEditableText(inputEl).text
      : normalizeNewlines(getInputValue(inputEl));

    const storedRisks = JSON.parse(pill.dataset.risks || '[]');
    let redactedToApply = pill.dataset.redacted;

    if (liveText !== pill.dataset.content) {
      // Text changed — find each risk.text in live text and build resolved risks
      const resolvedRisks = [];
      for (const risk of storedRisks) {
        const idx = liveText.indexOf(risk.text);
        if (idx === -1) continue;
        resolvedRisks.push({ ...risk, start: idx, end: idx + risk.text.length });
      }
      redactedToApply = redact(liveText, resolvedRisks);
    }

    setInputValue(inputEl, redactedToApply);
    navigator.clipboard.writeText(redactedToApply).catch(() => {});
    clearPasteTargetElement();
    removeInlineSuggestions();
    pill.remove();
    if (updateLog) updateLog(scanId, 'fix').catch(() => {});
  });

  pill.querySelector('#ai-guardrail-pill-ignore').addEventListener('click', () => {
    closePill();
  });
}
