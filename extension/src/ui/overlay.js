/**
 * Inline highlighting + tooltip for detected risks.
 *
 * Refactor: replace pixel-positioned overlay divs with DOM Range-based highlights
 * using the CSS Custom Highlight API.
 */

import { getPlaceholder, redact } from '../utils/detectors/index.js';
import { getInputElement, getInputValue, setInputValue } from '../utils/input.js';
import { getContentEditableText, normalizeNewlines, mapRisksToDomText } from '../utils/rangeMapping.js';
import { setOverlayTargetElement, clearOverlayTargetElement, clearPasteTargetElement, isScanStale, clearScan } from '../state/scanState.js';
import { matchToRange } from '../utils/rangeMapping.js';


const HIGHLIGHT_NAME = 'ai-guardrail-highlight';
const STYLE_ID = 'ai-guardrail-style';
const TOOLTIP_ID = 'ai-guardrail-inline-tooltip';

let currentOverlayTarget = null;
const overlayRegistry = new WeakMap();

let _hideTimer = null;
let _tooltipHovered = false;

function syncPosition(overlay, targetElement) {
  if (!overlay || !targetElement || !document.body.contains(targetElement)) return;
  const r = targetElement.getBoundingClientRect();
  overlay.style.top = r.top + 'px';
  overlay.style.left = r.left + 'px';
  overlay.style.width = r.width + 'px';
  overlay.style.height = r.height + 'px';
}

function detachOverlay(targetElement) {
  const rec = overlayRegistry.get(targetElement);
  if (!rec) return;
  rec.resizeObs?.disconnect();
  rec.intersectObs?.disconnect();
  window.removeEventListener('scroll', rec.onScroll, { capture: true });
  window.removeEventListener('resize', rec.onResize);
  rec.el.remove();
  overlayRegistry.delete(targetElement);
  if (currentOverlayTarget === targetElement) currentOverlayTarget = null;
}

function getOrCreateOverlay(inputElement) {
  const existing = overlayRegistry.get(inputElement);
  if (existing) {
    existing.el.style.display = 'block';
    syncPosition(existing.el, inputElement);
    return existing.el;
  }

  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483645;
    overflow: visible;
    display: block;
  `;
  document.body.appendChild(overlay);

  // Sync overlay bounds AND re-render underlines so they track scrolled Range rects.
  // Without re-rendering, underlines drift because their absolute offsets are baked
  // in from Range.getClientRects() at last-render time, not current scroll position.
  const syncAndRender = () => {
    syncPosition(overlay, inputElement);
    const s = stateByElement.get(inputElement);
    if (s?.riskRanges?.length > 0) {
      renderRectOverlays(inputElement, s.riskRanges);
    }
  };

  const resizeObs = new ResizeObserver(syncAndRender);
  resizeObs.observe(inputElement);

  const intersectObs = new IntersectionObserver((entries) => {
    if (entries[0]) {
      overlay.style.display = entries[0].isIntersecting ? 'block' : 'none';
      syncAndRender();
    }
  }, { threshold: 0, rootMargin: '20px' });
  intersectObs.observe(inputElement);

  window.addEventListener('scroll', syncAndRender, { passive: true, capture: true });
  window.addEventListener('resize', syncAndRender);
  syncAndRender();

  overlayRegistry.set(inputElement, {
    el: overlay,
    resizeObs,
    intersectObs,
    onScroll: syncAndRender,
    onResize: syncAndRender,
  });

  return overlay;
}

function clearRectOverlays(inputElement) {
  const rec = inputElement ? overlayRegistry.get(inputElement) : null;
  if (rec) rec.el.replaceChildren();
}
const stateByElement = new WeakMap(); // element -> state

function applyInlineSuggestion(scanId, risk, fullText, allRisks, inputElement, onRescan, updateLog) {
  // Re-read live text at click time
  const liveText = inputElement.isContentEditable || inputElement.getAttribute('contenteditable') === 'true'
    ? getContentEditableText(inputElement).text
    : normalizeNewlines(getInputValue(inputElement));

  let resolvedRisk = risk;
  if (liveText.slice(risk.start, risk.end) !== risk.text) {
    const newStart = liveText.indexOf(risk.text);
    if (newStart === -1) return; // text gone, nothing to redact
    resolvedRisk = { ...risk, start: newStart, end: newStart + risk.text.length };
  }

  const redacted = redact(liveText, [resolvedRisk]);
  setInputValue(inputElement, redacted);

  if (updateLog) updateLog(scanId, 'fix').catch(() => {});
  setTimeout(() => {
    const newText = getInputValue(getInputElement());
    if (onRescan) onRescan(newText);
  }, 100);
}

function supportsHighlights() {
  return !!(window.CSS && CSS.highlights && typeof Highlight !== 'undefined');
}

const _ceMirrorSet = new Set();

function clearHighlights(inputElement) {
  clearRectOverlays(inputElement);
  try {
    if (supportsHighlights()) CSS.highlights.delete(HIGHLIGHT_NAME);
  } catch (_) {}
  _ceMirrorSet.forEach((mirror) => { mirror.style.display = 'none'; });
}

/** Build text index on demand when null (e.g. paste before DOM sync) */
function ensureTextIndex(inputElement, fullText) {
  if (!inputElement || !fullText) return null;
  try {
    const { text, index } = getContentEditableText(inputElement);
    const domNorm = normalizeNewlines(text || '');
    if (domNorm.length < 10) return null;
    return { index, domText: domNorm };
  } catch (_) {
    return null;
  }
}

export function injectHighlightCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    ::highlight(${HIGHLIGHT_NAME}) {
      text-decoration: underline;
      text-decoration-style: dashed;
      text-decoration-color: #ff4d4f;
      text-decoration-thickness: 2px;
      text-underline-offset: 2px;
    }

    .pii-underline {
      text-decoration: underline dashed #ff4d4f;
      text-decoration-thickness: 2px;
      text-underline-offset: 2px;
    }

    [data-pii-underline] {
      pointer-events: none !important;
      border-bottom: 2px dashed #ff4d4f !important;
    }

    #${TOOLTIP_ID} {
      position: fixed;
      z-index: 2147483647;
      display: none;
      min-width: 280px;
      max-width: min(420px, calc(100vw - 24px));
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 12px 48px rgba(0,0,0,0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
    }

    #${TOOLTIP_ID} .ag-header {
      background: rgba(220, 38, 38, 0.15);
      color: #fff;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    #${TOOLTIP_ID} .ag-body {
      padding: 14px;
      font-size: 13px;
    }

    #${TOOLTIP_ID} .ag-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    #${TOOLTIP_ID} .ag-preview {
      margin-bottom: 14px;
      background: rgba(0,0,0,0.2);
      padding: 8px 10px;
      border-radius: 8px;
      font-family: ui-monospace, 'Source Code Pro', monospace;
      font-size: 12px;
      line-height: 1.4;
    }

    #${TOOLTIP_ID} .ag-old {
      color: #ef4444;
      text-decoration: line-through;
      opacity: 0.8;
    }

    #${TOOLTIP_ID} .ag-new {
      color: #10b981;
      font-weight: 700;
    }

    #${TOOLTIP_ID} .ag-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    #${TOOLTIP_ID} button {
      border: none;
      outline: none !important;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      padding: 8px 16px;
      transition: all 0.2s ease;
    }

    #${TOOLTIP_ID} .ag-update {
      background: #10b981;
      color: #fff;
      flex: 1;
    }
    #${TOOLTIP_ID} .ag-update:hover { background: #059669; }

    #${TOOLTIP_ID} .ag-dismiss {
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.8);
    }
    #${TOOLTIP_ID} .ag-dismiss:hover { background: rgba(255,255,255,0.15); color: #fff; }
  `;
  document.head.appendChild(style);
}

const _mirrors = new WeakMap();

function getOrCreateMirror(textarea) {
  if (_mirrors.has(textarea)) return _mirrors.get(textarea);

  const styles = window.getComputedStyle(textarea);
  const copyProps = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
    'letterSpacing', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'boxSizing', 'width', 'overflowX', 'overflowY', 'whiteSpace', 'wordWrap', 'wordBreak',
    'tabSize',
  ];

  const mirror = document.createElement('div');
  copyProps.forEach(p => { mirror.style[p] = styles[p]; });

  mirror.style.position = 'absolute';
  mirror.style.top = textarea.offsetTop + 'px';
  mirror.style.left = textarea.offsetLeft + 'px';
  mirror.style.color = 'transparent';
  mirror.style.background = 'transparent';
  mirror.style.pointerEvents = 'none';
  // Must be ABOVE the textarea (not below) so underlines are visible;
  // pointer-events: none ensures the mirror doesn't intercept user interaction.
  mirror.style.zIndex = String((parseInt(styles.zIndex) || 0) + 1);
  mirror.style.overflow = 'hidden';
  mirror.setAttribute('aria-hidden', 'true');

  textarea.parentElement.style.position = 'relative';
  textarea.parentElement.appendChild(mirror);
  _mirrors.set(textarea, mirror);

  textarea.addEventListener('scroll', () => {
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  }, { passive: true });

  return mirror;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function renderTextareaHighlights(textarea, fullText, risks) {
  const mirror = getOrCreateMirror(textarea);
  renderMirrorContent(mirror, fullText, risks);
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;
}

function renderMirrorContent(mirror, fullText, risks) {
  const sorted = [...risks].sort((a, b) => a.start - b.start);
  let html = '';
  let cursor = 0;
  for (const risk of sorted) {
    html += escapeHtml(fullText.slice(cursor, risk.start));
    html += `<span class="pii-underline">${escapeHtml(fullText.slice(risk.start, risk.end))}</span>`;
    cursor = risk.end;
  }
  html += escapeHtml(fullText.slice(cursor));
  mirror.innerHTML = html;
}

function renderRectOverlays(inputElement, riskRanges) {
  const overlay = getOrCreateOverlay(inputElement);
  // Force-sync overlay position before computing offsets — prevents "floating"
  // when the overlay was created before the editor finished laying out.
  syncPosition(overlay, inputElement);
  const inputRect = inputElement.getBoundingClientRect();

  overlay.replaceChildren();

  for (const { risk, range } of riskRanges) {
    let rects;
    try {
      rects = Array.from(range.getClientRects());
    } catch {
      continue;
    }

    for (const rect of rects) {
      if (rect.width < 2 || rect.height < 2) continue;

      const left = rect.left - inputRect.left;
      const top = rect.top - inputRect.top + rect.height - 3;

      const div = document.createElement('div');
      div.setAttribute('data-pii-underline', risk?.type ?? 'pii');
      div.setAttribute('aria-hidden', 'true');
      div.style.cssText = `
        position: absolute;
        pointer-events: none;
        left:   ${left}px;
        top:    ${top}px;
        width:  ${rect.width}px;
        height: 3px;
        border-bottom: 2px dashed #ff4d4f;
        z-index: 2147483646;
      `;
      overlay.appendChild(div);
    }
  }
}

export function highlightRisks(inputElement, risks, fullText = '', textIndex = null) {
  clearHighlights(inputElement);
  if (!inputElement || !document.body.contains(inputElement)) return [];

  // Textarea: use mirror-div pattern (no CSS Highlight API support)
  if (inputElement.tagName === 'TEXTAREA') {
    renderTextareaHighlights(inputElement, fullText, risks);
    return [];
  }

  // Contenteditable: use rect-based overlays (ProseMirror-safe)
  const isCE = inputElement.isContentEditable || inputElement.getAttribute?.('contenteditable') === 'true';
  if (!isCE) return [];

  // When textIndex is null (e.g. paste before DOM sync), try to build from DOM
  let index = textIndex;
  let risksToUse = risks;
  if (!index) {
    const built = ensureTextIndex(inputElement, fullText);
    if (built) {
      index = built.index;
      if (built.domText !== fullText) {
        const mapped = mapRisksToDomText(risks, built.domText);
        if (!mapped || mapped.length === 0) return [];
        risksToUse = mapped;
      }
    }
  }
  if (!index) return [];

  const riskRanges = [];

  for (const risk of risksToUse) {
    const range = matchToRange(index, risk.start, risk.end);
    if (!range) continue;
    riskRanges.push({ risk, range });
  }

  if (riskRanges.length === 0) return [];

  // Prefer CSS Custom Highlight API — browser paints underlines as part of the text,
  // so they track scroll/resize/reflow automatically. No floating possible.
  if (supportsHighlights()) {
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...riskRanges.map(rr => rr.range)));
    return riskRanges;
  }

  // Fallback: rect overlay divs (re-synced by scroll/resize observers)
  renderRectOverlays(inputElement, riskRanges);
  return riskRanges;
}

function ensureTooltipEl() {
  let tooltip = document.getElementById(TOOLTIP_ID);
  if (tooltip) return tooltip;

  tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;
  tooltip.innerHTML = `
    <div class="ag-header">
      <span style="font-weight: 700;">🛡️ PII suggestion</span>
      <span class="ag-source" style="font-size: 11px; opacity: 0.9;"></span>
    </div>
    <div class="ag-body">
      <div class="ag-sub">Improve your text</div>
      <div class="ag-preview">
        <span class="ag-old"></span>
        <span class="ag-new"></span>
      </div>
      <div class="ag-actions">
        <button class="ag-update" type="button">Update</button>
        <button class="ag-dismiss" type="button">🗑 Dismiss</button>
      </div>
    </div>
  `;

  tooltip.addEventListener('mouseenter', () => {
    _tooltipHovered = true;
    clearTimeout(_hideTimer);
    _hideTimer = null;
  });
  tooltip.addEventListener('mouseleave', () => {
    _tooltipHovered = false;
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => {
      if (!_tooltipHovered) hideTooltip();
    }, 300);
  });

  document.body.appendChild(tooltip);
  return tooltip;
}

function hideTooltip() {
  clearTimeout(_hideTimer);
  _hideTimer = null;
  _tooltipHovered = false;
  const tooltip = document.getElementById(TOOLTIP_ID);
  if (tooltip) tooltip.style.display = 'none';
}

function sourceToLabel(detectionSource) {
  return detectionSource === 'local' ? 'AI' : 'Local';
}

function throttle(fn, waitMs) {
  let last = 0;
  let trailingTimer = null;
  let lastArgs = null;

  return function throttled(...args) {
    const now = Date.now();
    lastArgs = args;
    if (now - last >= waitMs) {
      last = now;
      fn.apply(this, args);
      return;
    }
    if (trailingTimer) return;
    trailingTimer = setTimeout(() => {
      trailingTimer = null;
      last = Date.now();
      fn.apply(this, lastArgs);
    }, Math.max(0, waitMs - (now - last)));
  };
}

function pointInRect(x, y, rect, pad = 1) {
  return (
    x >= rect.left - pad &&
    x <= rect.right + pad &&
    y >= rect.top - pad &&
    y <= rect.bottom + pad
  );
}

function attachElementListeners(inputElement) {
  if (!inputElement) return;
  const existing = stateByElement.get(inputElement) || {};
  if (existing.listenersAttached) return;

  const state = { ...existing, listenersAttached: true };

  const onInput = () => {
    clearHighlights(inputElement);
    hideTooltip();
  };

  // Re-render rect underlines when the editor internally scrolls (long text).
  // Not needed when CSS Highlight API is active — the browser tracks ranges natively.
  const onContentScroll = () => {
    if (supportsHighlights()) return;
    const s = stateByElement.get(inputElement);
    if (s && s.riskRanges && s.riskRanges.length > 0) {
      renderRectOverlays(inputElement, s.riskRanges);
    }
  };

  const onMouseLeave = () => {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(() => {
      if (!_tooltipHovered) hideTooltip();
    }, 300);
  };

  const onMouseMove = throttle((e) => {
    const s = stateByElement.get(inputElement);
    if (!s || !s.riskRanges || s.riskRanges.length === 0) {
      hideTooltip();
      return;
    }

    const { clientX: x, clientY: y } = e;
    let hovered = null;

    for (const rr of s.riskRanges) {
      let matchedRect = null;
      const rects = rr.range.getClientRects();
      for (const rect of rects) {
        if (pointInRect(x, y, rect, 2)) {
          matchedRect = rect;
          break;
        }
      }
      if (matchedRect) {
        hovered = { rr, rect: matchedRect };
        break;
      }
    }

    if (!hovered) {
      if (!_hideTimer) {
        _hideTimer = setTimeout(() => {
          if (!_tooltipHovered) hideTooltip();
        }, 300);
      }
      return;
    }

    clearTimeout(_hideTimer);
    _hideTimer = null;

    const tooltip = ensureTooltipEl();
    const risk = hovered.rr.risk;
    const placeholder = s.placeholderMap?.get(risk) ?? getPlaceholder(risk.type, 1);
    const srcLabel = sourceToLabel(s.detectionSource);

    tooltip.querySelector('.ag-source').textContent = srcLabel;
    tooltip.querySelector('.ag-old').textContent = risk.text;
    tooltip.querySelector('.ag-new').textContent = ` ${placeholder}`;

    const updateBtn = tooltip.querySelector('.ag-update');
    const dismissBtn = tooltip.querySelector('.ag-dismiss');

    updateBtn.onclick = (ev) => {
      ev.stopPropagation();
      hideTooltip();
      clearHighlights(inputElement);
      applyInlineSuggestion(s.scanId, risk, s.fullText, s.risks, inputElement, s.onRescan, s.updateLog);
    };

    dismissBtn.onclick = (ev) => {
      ev.stopPropagation();
      hideTooltip();
      s.risks = (s.risks || []).filter(r => r !== risk);
      s.riskRanges = highlightRisks(inputElement, s.risks || [], s.fullText || '', s.textIndex || null);
      stateByElement.set(inputElement, s);
    };

    tooltip.style.display = 'block';

    const rect = hovered.rect;
    const margin = 10;
    const desiredTop = Math.max(margin, rect.top - margin);
    const desiredLeft = Math.max(margin, rect.left);

    tooltip.style.top = `${desiredTop}px`;
    tooltip.style.left = `${desiredLeft}px`;
    tooltip.style.transform = 'translateY(-100%)';

    const { width: tw, height: th } = tooltip.getBoundingClientRect();
    let left = desiredLeft;
    if (left + tw + margin > window.innerWidth) left = Math.max(margin, window.innerWidth - tw - margin);

    let top = desiredTop;
    if (top - th - margin < 0) {
      // If not enough space above, show below the rect
      top = Math.min(window.innerHeight - margin, rect.bottom + margin);
      tooltip.style.transform = 'translateY(0)';
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }, 80);

  inputElement.addEventListener('input', onInput);
  inputElement.addEventListener('scroll', onContentScroll, { passive: true });
  inputElement.addEventListener('mousemove', onMouseMove);
  inputElement.addEventListener('mouseleave', onMouseLeave);

  state.onInput = onInput;
  state.onContentScroll = onContentScroll;
  state.onMouseMove = onMouseMove;
  state.onMouseLeave = onMouseLeave;
  stateByElement.set(inputElement, state);
}

function detachElementListeners(inputElement) {
  const state = inputElement ? stateByElement.get(inputElement) : null;
  if (!inputElement || !state || !state.listenersAttached) return;

  inputElement.removeEventListener('input', state.onInput);
  inputElement.removeEventListener('scroll', state.onContentScroll);
  inputElement.removeEventListener('mousemove', state.onMouseMove);
  inputElement.removeEventListener('mouseleave', state.onMouseLeave);

  state.listenersAttached = false;
  state.onInput = null;
  state.onMouseMove = null;
  state.onMouseLeave = null;
  state.riskRanges = [];
  state.risks = [];
  stateByElement.set(inputElement, state);
}

export function showInlineSuggestions(scanId, risks, fullText, source, filename, detectionSource, targetElement, onRescan, updateLog, textIndex = null) {
  const inputElement = targetElement || getInputElement();
  if (!inputElement) return;

  if (isScanStale(scanId)) {
    clearScan(scanId);
    return;
  }

  const fullRisks = risks.filter(r => r.confidence > 0.5);
  if (fullRisks.length === 0) {
    removeInlineSuggestions();
    return;
  }

  setOverlayTargetElement(inputElement);
  if (currentOverlayTarget && currentOverlayTarget !== inputElement) {
    detachOverlay(currentOverlayTarget);
  }
  currentOverlayTarget = inputElement;

  injectHighlightCSS();
  attachElementListeners(inputElement);

  // Assign placeholders by position (first in text = 1, second = 2, etc.)
  const byPosition = [...fullRisks].sort((a, b) => a.start - b.start);
  const counters = {};
  const placeholderMap = new Map();
  for (const risk of byPosition) {
    counters[risk.type] = (counters[risk.type] || 0) + 1;
    placeholderMap.set(risk, getPlaceholder(risk.type, counters[risk.type]));
  }

  const riskRanges = highlightRisks(inputElement, fullRisks, fullText, textIndex);

  const existing = stateByElement.get(inputElement) || {};
  stateByElement.set(inputElement, {
    ...existing,
    scanId,
    fullText,
    textIndex,
    risks: fullRisks,
    riskRanges,
    detectionSource,
    onRescan,
    updateLog,
    placeholderMap,
  });

  // After paste, editors like ProseMirror/ChatGPT may still be reflowing (auto-growing).
  // Re-render rect overlays after two animation frames to pick up settled positions.
  // Not needed for CSS Highlight API — its ranges are live DOM objects.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (isScanStale(scanId) || !document.body.contains(inputElement)) return;
      if (supportsHighlights()) return;
      const s = stateByElement.get(inputElement);
      if (s?.riskRanges?.length > 0) {
        renderRectOverlays(inputElement, s.riskRanges);
      }
    });
  });
}

export function updateOverlayPosition() {
  if (currentOverlayTarget) {
    const rec = overlayRegistry.get(currentOverlayTarget);
    if (rec) syncPosition(rec.el, currentOverlayTarget);
  }
}

export function removeInlineSuggestions() {
  clearHighlights(currentOverlayTarget);
  hideTooltip();

  if (currentOverlayTarget) {
    detachElementListeners(currentOverlayTarget);
    detachOverlay(currentOverlayTarget);
  }
  clearOverlayTargetElement();
  clearPasteTargetElement();
  currentOverlayTarget = null;
}

// Re-sync when tab becomes visible (e.g. after minimize/restore)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateOverlayPosition();
  });
}

// Auto-detach overlays when input elements are removed from DOM
if (typeof document !== 'undefined' && document.body) {
  new MutationObserver((mutations) => {
    for (const { removedNodes } of mutations) {
      for (const node of removedNodes) {
        if (!(node instanceof Element)) continue;
        const candidates = [node, ...node.querySelectorAll('input,textarea,[contenteditable]')];
        for (const el of candidates) {
          if (overlayRegistry.has(el)) detachOverlay(el);
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
