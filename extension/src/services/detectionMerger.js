/**
 * Merges AI and UK regex risk arrays.
 * Regex pipeline (detectUKPII) is the ground truth.
 * AI risks are merged when they don't overlap existing regex risks.
 *
 * @param {Array} aiRisks   - Risks from detectPIIWithAI()
 * @param {string} fullText - Full text (for validation and regex detection)
 * @returns {Array} Deduplicated risks
 */

import { detectUKPII, FALSE_POSITIVES } from '../utils/detectors/index.js';

function isValidOffset(risk, fullText) {
  return (
    typeof risk.start === 'number' &&
    typeof risk.end === 'number' &&
    risk.start >= 0 &&
    risk.end <= fullText.length &&
    risk.start < risk.end &&
    fullText.slice(risk.start, risk.end) === risk.text
  );
}

function normalizeConfidence(conf) {
  if (typeof conf === 'boolean') return conf ? 0.9 : 0.5;
  if (conf > 1) return conf / 100;
  return Math.min(1, Math.max(0, Number(conf) || 0.5));
}

function withRisk(r) {
  const conf = normalizeConfidence(r.confidence);
  return { ...r, confidence: conf, risk: conf >= 0.85 ? 'HIGH' : 'MEDIUM' };
}

export function mergeRisks(aiRisks = [], fullText = '') {
  const validAi = fullText ? (aiRisks || []).filter((r) => isValidOffset(r, fullText)) : aiRisks || [];

  const regexRisks = detectUKPII(fullText).map(withRisk);

  const merged = [...regexRisks];

  for (const ai of validAi.map(withRisk)) {
    const overlaps = merged.some((r) => !(ai.end <= r.start || ai.start >= r.end));
    if (!overlaps) merged.push(ai);
  }

  return merged
    .filter((r) => r.type !== 'name' || !FALSE_POSITIVES.has(r.text.trim().toLowerCase()))
    .sort((a, b) => a.start - b.start);
}
