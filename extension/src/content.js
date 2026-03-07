/**
 * Content Script - AI Guardrail orchestrator
 * Coordinates detection, handlers, and UI
 */

import { getContext } from './utils/context.js';
import { getInputElement, getInputValue } from './utils/input.js';
import { getPasteTargetElement, clearPasteTargetElement, createScan, clearAllScans, clearOverlayTargetElement, isScanStale } from './state/scanState.js';
import { detectPIIWithAI } from './services/pii-ai-service.js';
import { mergeRisks } from './services/detectionMerger.js';
import { createInputHandler, updateLastRiskLevel } from './handlers/inputHandler.js';
import { createPasteHandler } from './handlers/pasteHandler.js';
import { createFileHandler } from './handlers/fileHandler.js';
import { getContentEditableText, normalizeNewlines, mapRisksToDomText } from './utils/rangeMapping.js';
import { showInlineSuggestions, removeInlineSuggestions, injectHighlightCSS } from './ui/overlay.js';
import { showBodyPopup } from './ui/popup.js';

function sendStatsUpdate(risks, domain) {
  try {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: 'STATS_UPDATE',
        risksFound: risks.length,
        highRisk: risks.filter(r => r.risk === 'HIGH').length,
        mediumRisk: risks.filter(r => r.risk === 'MEDIUM' || r.risk == null).length,
        domain: domain || window.location.hostname
      }).catch(() => {});
    }
  } catch (_) {}
}

function isExtensionContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id !== undefined;
  } catch (_) {
    return false;
  }
}

async function logRisk(scanId, risks, source, filename) {
  try {
    if (!isExtensionContextValid()) return;
    chrome.runtime.sendMessage({
      type: 'LOG_RISK',
      entry: { scanId, timestamp: Date.now(), risks: risks.map(r => ({ type: r.type, confidence: r.confidence })), source, filename: filename || null, userAction: null }
    }, () => {});
  } catch (e) {
    if (e?.message?.includes('Extension context invalidated')) return;
  }
}


async function updateLog(scanId, userAction) {
  try {
    if (!isExtensionContextValid()) return;
    chrome.runtime.sendMessage({ type: 'UPDATE_LOG', scanId, userAction }, () => {});
  } catch (e) {
    if (e?.message?.includes('Extension context invalidated')) return;
  }
}

async function scanAndAlert(content, source, filename = null) {
  if (typeof content !== 'string') return;

  if (source !== 'paste') clearPasteTargetElement();
  const inputElement = getPasteTargetElement() || getInputElement();

  let fullText;
  let textIndex = null;

  if (inputElement) {
    if (inputElement.isContentEditable || inputElement.getAttribute('contenteditable') === 'true') {
      const result = getContentEditableText(inputElement);
      const domText = normalizeNewlines(result.text || '');
      const pastedNorm = content ? normalizeNewlines(content) : '';
      // For paste: use DOM when it has ≥80% of pasted content so we can underline; else clipboard + retry
      if (source === 'paste' && pastedNorm && pastedNorm.length > domText.length + 5 && domText.length < pastedNorm.length * 0.8) {
        fullText = pastedNorm;
        textIndex = null;
      } else {
        fullText = domText || pastedNorm || content || '';
        textIndex = result.index;
      }
    } else {
      fullText = normalizeNewlines(getInputValue(inputElement) || content);
    }
  } else {
    fullText = content ? normalizeNewlines(content) : '';
  }

  if (!fullText) {
    updateLastRiskLevel(null);
    clearPasteTargetElement();
    removeInlineSuggestions();
    document.getElementById('ai-guardrail-pill')?.remove();
    return;
  }

  const context = getContext();
  context.text = fullText;

  let aiRisks = [];
  let effectiveSource = 'regex';

  try {
    const { risks, source: detSrc } = await detectPIIWithAI(fullText);
    aiRisks = risks || [];
    effectiveSource = detSrc;
  } catch (err) {
    effectiveSource = 'regex-fallback';
    try {
      chrome.runtime.sendMessage({ type: 'DETECTION_FALLBACK', reason: err?.message, timestamp: Date.now() }).catch(() => {});
    } catch (_) {}
  }

  let filteredRisks = mergeRisks(aiRisks, fullText);

  if (filteredRisks.length === 0) {
    updateLastRiskLevel(null);
    clearPasteTargetElement();
    removeInlineSuggestions();
    document.getElementById('ai-guardrail-pill')?.remove();
    return;
  }

  const riskLevel = filteredRisks.some(r => r.risk === 'HIGH') ? 'HIGH' : 'MEDIUM';
  updateLastRiskLevel(riskLevel);

  const scanId = createScan(fullText, inputElement);
  const targetElement = inputElement;

  const onRescan = (newText) => {
    if (newText.length > 10) scanAndAlert(newText, 'typing');
    else removeInlineSuggestions();
  };

  showInlineSuggestions(scanId, filteredRisks, fullText, source, filename, effectiveSource, targetElement, onRescan, updateLog, textIndex);

  // When paste used clipboard text (textIndex=null), DOM may lag — retry highlights once DOM has content
  if (textIndex === null && targetElement && (targetElement.isContentEditable || targetElement.getAttribute?.('contenteditable') === 'true')) {
    const retryDelays = fullText.length > 300 ? [0, 150, 400, 800, 1500, 2500] : [0, 150, 400, 800];
    const retryHighlight = () => {
      if (isScanStale(scanId)) return;
      // Prefer getInputElement (main input) then paste target; use whichever has more matching text
      const mainInput = getInputElement();
      let el = targetElement;
      let result = getContentEditableText(el);
      let domText = normalizeNewlines(result.text || '');
      if (mainInput && mainInput !== el) {
        const mainResult = getContentEditableText(mainInput);
        const mainText = normalizeNewlines(mainResult.text || '');
        if (mainText.length > domText.length && mainText.length >= fullText.length * 0.5) {
          el = mainInput;
          result = mainResult;
          domText = mainText;
        }
      }
      if (domText.length < 10) return;
      let risksToUse = filteredRisks;
      let textToUse = domText;
      if (domText === fullText) {
        textToUse = domText;
      } else {
        const mapped = mapRisksToDomText(filteredRisks, domText);
        if (!mapped || mapped.length === 0) return;
        risksToUse = mapped;
      }
      showInlineSuggestions(scanId, risksToUse, textToUse, source, filename, effectiveSource, el, onRescan, updateLog, result.index);
    };
    retryDelays.forEach((ms) => setTimeout(retryHighlight, ms));
    requestAnimationFrame(() => requestAnimationFrame(retryHighlight));
  }

  showBodyPopup(scanId, filteredRisks, fullText, source, filename, effectiveSource, targetElement, updateLog);

  sendStatsUpdate(filteredRisks, context.domain);
  logRisk(scanId, filteredRisks, source, filename).catch(() => {});
}

function clearScanState() {
  clearPasteTargetElement();
  clearOverlayTargetElement();
  clearAllScans();
  removeInlineSuggestions();
  document.getElementById('ai-guardrail-pill')?.remove();
}

function init() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearScanState();
  });

  injectHighlightCSS();

  const handleInputChange = createInputHandler(scanAndAlert);
  const handlePaste = createPasteHandler(scanAndAlert);
  const handleFileUpload = createFileHandler(scanAndAlert);

  document.addEventListener('paste', (e) => { handlePaste(e); }, true);
  document.addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'file') handleFileUpload(e);
  }, true);
  document.addEventListener('input', (e) => { handleInputChange(e); }, true);
  document.addEventListener('input', (e) => {
    if (e.target.isContentEditable) handleInputChange(e);
  }, true);

  const setupInputMonitoring = () => {
    const inputElement = getInputElement();
    if (inputElement) {
      inputElement.addEventListener('input', () => {
        try {
          if (window.CSS && CSS.highlights) CSS.highlights.delete('ai-guardrail-highlight');
        } catch (_) {}
      });
      let lastValue = inputElement.value || inputElement.textContent || '';
      let checkCount = 0;
      const monitorInterval = setInterval(() => {
        const currentValue = inputElement.value || inputElement.textContent || '';
        if (currentValue !== lastValue) {
          const changeSize = currentValue.length - lastValue.length;
          if (changeSize > 20 && currentValue.length > lastValue.length) {
            const newText = currentValue.substring(lastValue.length);
            scanAndAlert(newText, 'paste');
          }
          lastValue = currentValue;
        }
        checkCount++;
        if (checkCount > 600) clearInterval(monitorInterval);
      }, 500);
    } else {
      setTimeout(setupInputMonitoring, 2000);
    }
  };
  setupInputMonitoring();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
