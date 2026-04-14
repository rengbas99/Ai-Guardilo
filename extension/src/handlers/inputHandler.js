/**
 * Input change handler (typing with adaptive debounce)
 * Paste detection is exclusively owned by pasteHandler.js —
 * this handler only fires for keyboard input.
 */

import { removeInlineSuggestions } from '../ui/overlay.js';

let lastKnownRiskLevel = null;

export function updateLastRiskLevel(level) {
  lastKnownRiskLevel = level;
}

function getDebounceMs() {
  switch (lastKnownRiskLevel) {
    case 'HIGH':   return 80;   // Near-real-time: user is actively entering PII
    case 'MEDIUM': return 200;  // Standard
    default:       return 350;  // Low probability of PII
  }
}

function scheduleScan(fn) {
  if (lastKnownRiskLevel === 'HIGH') {
    fn();
  } else if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(fn, { timeout: 500 });
  } else {
    setTimeout(fn, 50);
  }
}

function isTrackedElement(el) {
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
  if (el.isContentEditable === true || el.getAttribute?.('contenteditable') === 'true') return true;
  return !!el.closest?.('[contenteditable="true"]');
}

function resolveInputElement(el) {
  if (!el) return null;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el;
  return el.closest?.('[contenteditable="true"]') || (el.isContentEditable ? el : null);
}

export function createInputHandler(scanAndAlert) {
  let timer = null;
  return function handleInputChange(event) {
    const input = resolveInputElement(event.target);
    if (!input || !isTrackedElement(event.target)) return;

    const value = input.value || input.textContent || input.innerText || '';

    removeInlineSuggestions();

    if (!value.trim()) {
      clearTimeout(timer);
      updateLastRiskLevel(null);
      document.getElementById('ai-guardrail-pill')?.remove();
      document.getElementById('ai-guardrail-sidebar')?.remove();
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(() => {
      scheduleScan(() => scanAndAlert(value, 'typing'));
    }, getDebounceMs());
  };
}
