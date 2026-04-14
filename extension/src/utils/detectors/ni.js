import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * UK National Insurance Number detector.
 *
 * Validates against HMRC spec:
 * - Prefix (2 chars):
 *   - 1st: [A-CEGHJ-PR-TW-Z] (Excl: D, F, I, Q, U, V)
 *   - 2nd: [A-CEGHJ-NPR-TW-Z] (Excl: D, F, I, O, Q, U, V)
 * - Number: 6 digits
 * - Suffix: [A-D]
 */

const RE_NI = /\b([A-Z]{2}[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?[A-D])(?!\d)/gi;
const RE_NI_CONTEXT = /\b(national\s*insurance|ni\s*number|nino|n\.i\.|ni)\b/i;

// HMRC forbidden first letters
const FORBIDDEN_1ST = new Set(['D', 'F', 'I', 'Q', 'U', 'V']);
// HMRC forbidden second letters
const FORBIDDEN_2ND = new Set(['D', 'F', 'I', 'O', 'Q', 'U', 'V']);

function isValidNIPrefix(prefix) {
  if (prefix.length !== 2) return false;
  const p1 = prefix[0].toUpperCase();
  const p2 = prefix[1].toUpperCase();
  if (FORBIDDEN_1ST.has(p1)) return false;
  if (FORBIDDEN_2ND.has(p2)) return false;
  // Specific disallowed combinations
  const p = p1 + p2;
  if (p === 'BG' || p === 'GB' || p === 'NK' || p === 'KN' || p === 'TN' || p === 'NT' || p === 'ZZ') return false;
  return true;
}

export function detectNI(text, claimed) {
  const risks = [];
  let match;
  RE_NI.lastIndex = 0;
  while ((match = RE_NI.exec(text)) !== null) {
    const raw = match[1];
    const prefix = raw.slice(0, 2);

    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const surrounding = text.slice(Math.max(0, start - 40), end + 20);
    const hasContext = RE_NI_CONTEXT.test(surrounding);

    if (!isValidNIPrefix(prefix)) {
      // Allow invalid prefixes (dummy data) if strong explicit context is present
      if (!hasContext) continue;
      risks.push(makeRisk('ni_number', match[0], start, end, 0.75));
      claimSpan(claimed, start, end);
      continue;
    }

    const confidence = hasContext ? 0.99 : 0.92;

    risks.push(makeRisk('ni_number', match[0], start, end, confidence));
    claimSpan(claimed, start, end);
  }

  return risks;
}
