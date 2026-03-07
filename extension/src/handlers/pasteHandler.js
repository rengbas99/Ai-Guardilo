/**
 * Paste event handler
 */

import { setPasteTargetElement } from '../state/scanState.js';
import { getInputElement } from '../utils/input.js';

function isReasonablePasteTarget(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.width >= vw * 0.9 && rect.height >= vh * 0.85) return false;
  return true;
}

export function createPasteHandler(scanAndAlert) {
  return function handlePaste(event) {
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    if (!pastedText || pastedText.trim().length === 0) return;

    const target = event.target;
    setTimeout(() => {
      let el = null;
      if (target) {
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
          el = target;
        } else {
          el = target.closest?.('[contenteditable="true"], textarea, input[type="text"]') || null;
        }
      }
      if (el && !isReasonablePasteTarget(el)) {
        el = getInputElement();
      }
      setPasteTargetElement(el);
      scanAndAlert(pastedText, 'paste', null);
    }, 100);
  };
}
