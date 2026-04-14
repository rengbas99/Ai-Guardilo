import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * NHS Number detector with modulus-11 check-digit validation.
 *
 * Improvements over v1:
 * - validateNHS() implements the official modulus-11 algorithm — eliminates
 *   arbitrary 10-digit strings that happen to match the 3-3-4 digit pattern
 * - Context boosts confidence to 0.99; validated-only (no context) stays at 0.85
 * - Numbers where modulus 11 check fails are discarded entirely
 *
 * Algorithm (NHS Digital spec):
 *   Multiply digits 1-9 by weights 10,9,8,7,6,5,4,3,2
 *   Sum the products; remainder = sum % 11
 *   If remainder == 0 or remainder == 1 → invalid (check digit would be 11 or 10)
 *   Otherwise check digit = 11 - remainder; must match digit 10
 */

const RE_NHS = /\b(\d{3}[\s\-]\d{3}[\s\-]\d{4})(?=\D|$)/g;
const RE_NHS_CONTEXT = /\bnhs\b/i;
// "NHS Number:" is a strong explicit field label — enough to flag even if mod-11 fails
const RE_NHS_STRONG_CONTEXT = /\bnhs\s+number\b/i;

function validateNHS(raw) {
  const digits = raw.replace(/[\s\-]/g, '');
  if (digits.length !== 10) return false;

  const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return false;
  const checkDigit = 11 - remainder;
  return checkDigit === parseInt(digits[9], 10);
}

export function detectNHS(text, claimed) {
  const risks = [];
  let match;
  RE_NHS.lastIndex = 0;

  while ((match = RE_NHS.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const before = text.slice(Math.max(0, start - 20), start);
    const hasContext = RE_NHS_CONTEXT.test(before);
    const hasStrongContext = RE_NHS_STRONG_CONTEXT.test(before);

    if (!validateNHS(match[0])) {
      // Mod-11 fails: only emit when an explicit "NHS Number:" field label is present
      // (bare "NHS:" alone is not strong enough — could be surrounding prose)
      if (!hasStrongContext) continue;
      risks.push(makeRisk('nhs_number', match[0], start, end, 0.75));
      claimSpan(claimed, start, end);
      continue;
    }

    const confidence = hasContext ? 0.99 : 0.85;
    risks.push(makeRisk('nhs_number', match[0], start, end, confidence));
    claimSpan(claimed, start, end);
  }

  return risks;
}
