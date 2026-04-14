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

export function setInputValue(element, value) {
  if (!element) return false;

  if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
    // innerText preserves \n correctly; textContent and innerHTML both collapse them
    element.innerText = value;

    // Move cursor to end so the user can keep typing naturally
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    // Fire both input and change — React (ChatGPT) needs the native setter trick
    try {
      const proto = Object.getOwnPropertyDescriptor(
        window.HTMLElement.prototype, 'innerText'
      );
      if (proto?.set) proto.set.call(element, value);
    } catch (_) {}

    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;

  } else {
    // Standard textarea / input
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
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
