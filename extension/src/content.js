/**
 * Content Script - AI Guardrail orchestrator
 * Coordinates detection, handlers, and UI
 */

import { getContext } from './utils/context.js';
import { getInputElement, getInputValue } from './utils/input.js';
import { getPasteTargetElement, clearPasteTargetElement, createScan, clearAllScans, clearOverlayTargetElement, isScanStale } from './state/scanState.js';
import { mergeRisks } from './services/detectionMerger.js';
import { createInputHandler, updateLastRiskLevel } from './handlers/inputHandler.js';
import { createPasteHandler } from './handlers/pasteHandler.js';
import { createFileHandler } from './handlers/fileHandler.js';
import { getContentEditableText, normalizeNewlines, mapRisksToDomText } from './utils/rangeMapping.js';
import { showInlineSuggestions, removeInlineSuggestions, injectHighlightCSS } from './ui/overlay.js';
import { showBodyPopup, removeBodyPopup } from './ui/popup.js';
import { getPlaceholder } from './utils/detectors/shared.js';
import { detectPIIWithAI } from './services/pii-ai-service.js';

// Signature of the precise set of risks that the user last dismissed with 'X'
let lastDismissedSignature = '';

function isExtensionContextValid() {
  try {
    return !!(chrome.runtime?.id);
  } catch (_) {
    return false;
  }
}

function safeSendMessage(msg) {
  try {
    if (isExtensionContextValid()) {
      chrome.runtime.sendMessage(msg).catch(() => {});
    }
  } catch (_) {}
}

async function logRisk(scanId, risks, source, filename) {
  if (!isExtensionContextValid()) return;
  try {
    await chrome.runtime.sendMessage({
      type: 'LOG_RISK',
      entry: {
        scanId,
        timestamp: Date.now(),
        risks: risks.map(r => ({ type: r.type, confidence: r.confidence })),
        source,
        filename: filename || null,
        userAction: null,
      },
    });
  } catch (e) {
    if (e?.message?.includes('Extension context invalidated')) return;
  }
}

async function updateLog(scanId, userAction) {
  if (!isExtensionContextValid()) return;
  try {
    await chrome.runtime.sendMessage({ type: 'UPDATE_LOG', scanId, userAction });
  } catch (e) {
    if (e?.message?.includes('Extension context invalidated')) return;
  }
}

function sendStatsUpdate(risks) {
  safeSendMessage({
    type: 'STATS_UPDATE',
    risksFound: risks.length,
    highRisk: risks.filter(r => r.risk === 'HIGH').length,
    mediumRisk: risks.filter(r => r.risk === 'MEDIUM' || r.risk == null).length,
    domain: window.location.hostname,
  });
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
      // Use clipboard text when DOM hasn't caught up yet (< 80% of pasted length available)
      if (source === 'paste' && pastedNorm && domText.length < pastedNorm.length * 0.8) {
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
    removeBodyPopup();
    lastDismissedSignature = '';
    return;
  }

  getContext().text = fullText;

  // Hybrid Detection: Combine Chrome's on-device AI (experimental) with Regex logic
  let aiRisks = [];
  try {
    const aiResult = await detectPIIWithAI(fullText);
    aiRisks = aiResult.risks || [];
  } catch (e) {
    // Fall back silently to regex if AI is unavailable (standard Chrome extension behavior)
  }

  let filteredRisks = mergeRisks(aiRisks, fullText);

  if (filteredRisks.length === 0) {
    updateLastRiskLevel(null);
    clearPasteTargetElement();
    removeInlineSuggestions();
    document.getElementById('ai-guardrail-pill')?.remove();
    lastDismissedSignature = '';
    return;
  }

  const currentSignature = filteredRisks.map(r => `${r.type}:${r.text}`).sort().join('|');

  const riskLevel = filteredRisks.some(r => r.risk === 'HIGH') ? 'HIGH' : 'MEDIUM';
  updateLastRiskLevel(riskLevel);

  const scanId = createScan(fullText, inputElement);
  const targetElement = inputElement;

  const onRescan = (newText) => {
    if (newText.length > 10) scanAndAlert(newText, 'typing');
    else removeInlineSuggestions();
  };

  const handleUpdateLog = async (id, action) => {
    if (action === 'dismiss') {
      // Remember this exact combination of risks
      lastDismissedSignature = currentSignature;
    }
    return updateLog(id, action);
  };

  showInlineSuggestions(scanId, filteredRisks, fullText, source, filename, 'regex', targetElement, onRescan, handleUpdateLog, textIndex);

  // When paste used clipboard text (textIndex=null), DOM may lag — retry highlights once DOM has content.
  if (
    textIndex === null &&
    targetElement &&
    (targetElement.isContentEditable || targetElement.getAttribute?.('contenteditable') === 'true')
  ) {
    const retryDelays = fullText.length > 300
      ? [100, 300, 600, 1000, 1800, 3000]
      : [100, 300, 600, 1000];

    const retryHighlight = () => {
      if (isScanStale(scanId)) return;

      // Prefer whichever element has more matching text
      const mainInput = getInputElement();
      let el = targetElement;
      let result = getContentEditableText(el);
      let domText = normalizeNewlines(result.text || '');

      if (mainInput && mainInput !== el) {
        const mainResult = getContentEditableText(mainInput);
        const mainText = normalizeNewlines(mainResult.text || '');
        if (mainText.length > domText.length) {
          el = mainInput;
          result = mainResult;
          domText = mainText;
        }
      }

      // Wait until the DOM has at least 90% of the pasted content before mapping
      if (domText.length < fullText.length * 0.9) return;

      let risksToUse = filteredRisks;
      let textToUse = domText;

      if (domText !== fullText) {
        const mapped = mapRisksToDomText(filteredRisks, domText);
        if (!mapped || mapped.length === 0) return;
        risksToUse = mapped;
      }

      showInlineSuggestions(scanId, risksToUse, textToUse, source, filename, 'regex', el, onRescan, updateLog, result.index);
    };

    retryDelays.forEach(ms => setTimeout(retryHighlight, ms));
  }

  if (currentSignature !== lastDismissedSignature) {
    showBodyPopup(scanId, filteredRisks, fullText, source, filename, 'regex', targetElement, handleUpdateLog, onRescan);
  } else {
    // Suppress popup but ensure underline stays
    document.getElementById('ai-guardrail-pill')?.remove();
    document.getElementById('ai-guardrail-sidebar')?.remove();
  }

  sendStatsUpdate(filteredRisks);
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

  document.addEventListener('paste', handlePaste, true);
  document.addEventListener('change', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'file') handleFileUpload(e);
  }, true);
  // Single input listener covers both regular inputs and contenteditable
  document.addEventListener('input', handleInputChange, true);

  // Watch for new input elements added to the DOM (SPAs that render inputs late)
  const inputObserver = new MutationObserver(() => {
    const inputElement = getInputElement();
    if (inputElement && !inputElement.dataset.agAttached) {
      inputElement.dataset.agAttached = '1';
    }
  });
  inputObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
