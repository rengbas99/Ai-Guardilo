/**
 * Input element helpers for site-specific chat UIs
 * Uses text-field-edit for undo support and correct input events.
 */

import textFieldEdit from 'text-field-edit';

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Reject elements that span the full viewport (body/wrapper, not the actual input) */
function isReasonableInputSize(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.width >= vw * 0.9 && rect.height >= vh * 0.85) return false;
  return true;
}

function firstVisible(selectors, skipFullViewport = false) {
  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      if (skipFullViewport && !isReasonableInputSize(el)) continue;
      return el;
    }
  }
  return null;
}

const SELECTORS = [
  '#prompt-textarea',
  'div[contenteditable="true"].ProseMirror',
  'div.ql-editor[role="textbox"]',
  'div.ql-editor.textarea',
  'rich-textarea div.ql-editor',
  'div.ql-editor[contenteditable="true"]',
  'textarea[placeholder]',
  'div[contenteditable="true"][data-lexical-editor="true"]',
  'div[contenteditable="true"][data-lexical-editor]',
  'div[aria-label="Message Body"][contenteditable="true"]',
  'div[g_editable="true"]',
  'div[contenteditable="true"][aria-multiline="true"]',
  'div[contenteditable="true"].notranslate',
  'div[data-content-editable-leaf="true"]',
  'div.msg-form__contenteditable[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][role="combobox"]',
  '[contenteditable="true"]',
  'textarea',
  'input[type="text"]',
  'input:not([type])',
];

export function getInputElement() {
  return firstVisible(SELECTORS, true);
}

export function getInputValue(el) {
  if (!el) return '';
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || '';
  return el.innerText || el.textContent || '';
}

export function setInputValue(el, value) {
  if (!el) return false;
  try {
    textFieldEdit.set(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (e) {
    // Fallback for unsupported elements
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      el.innerText = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }
}

export function replaceInField(el, search, replacement) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    try {
      textFieldEdit.replace(el, search, replacement);
      return true;
    } catch (_) {
      return false;
    }
  }
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    const current = el.innerText || el.textContent || '';
    const newVal = current.replace(search, replacement);
    return setInputValue(el, newVal);
  }
  return false;
}
