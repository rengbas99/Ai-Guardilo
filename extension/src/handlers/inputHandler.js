/**
 * Input change handler (typing, debounce)
 * Fix 11: requestIdleCallback for non-urgent scans to avoid blocking main thread.
 * Fix 13: Adaptive debounce based on risk level.
 */

import { removeInlineSuggestions } from '../ui/overlay.js';

let lastKnownRiskLevel = null; // "HIGH" | "MEDIUM" | null

export function updateLastRiskLevel(level) {
  lastKnownRiskLevel = level;
}

function getDebounceMs() {
  switch (lastKnownRiskLevel) {
    case 'HIGH': return 80;   // Near-real-time: user is actively entering PII
    case 'MEDIUM': return 200; // Standard
    default: return 350;      // Long idle: low probability of PII
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
  const editable = el.closest?.('[contenteditable="true"]');
  return !!editable;
}

function resolveInputElement(el) {
  if (!el) return null;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el;
  const editable = el.closest?.('[contenteditable="true"]');
  return editable || (el.isContentEditable ? el : null);
}

export function createInputHandler(scanAndAlert) {
  let timer = null;
  return function handleInputChange(event) {
    const rawTarget = event.target;
    const input = resolveInputElement(rawTarget);
    if (!input || !isTrackedElement(rawTarget)) return;

    const newValue = input.value || input.textContent || input.innerText || '';

    removeInlineSuggestions();

    // If user cleared the text, immediately clear UI and skip debounced scan
    if (!newValue.trim()) {
      clearTimeout(timer);
      updateLastRiskLevel(null);
      document.getElementById('ai-guardrail-pill')?.remove();
      input.dataset.lastLength = '0';
      return;
    }

    if (newValue.length > 50 && input.dataset.lastLength) {
      const lastLength = parseInt(input.dataset.lastLength, 10);
      const changeSize = newValue.length - lastLength;

      if (changeSize > 20) {
        const newText = newValue.substring(lastLength);
        scanAndAlert(newText, 'paste');
      } else {
        clearTimeout(timer);
        timer = setTimeout(() => {
          scheduleScan(() => scanAndAlert(newValue, 'typing'));
        }, getDebounceMs());
      }
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        scheduleScan(() => scanAndAlert(newValue, 'typing'));
      }, getDebounceMs());
    }

    input.dataset.lastLength = newValue.length.toString();
  };
}
