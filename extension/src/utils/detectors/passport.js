import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * UK Passport number detector.
 *
 * Modern UK biometric passports (issued since 2006): 9 digits.
 * Older passports: 7-9 characters, may include letters.
 *
 * Because bare digit sequences are extremely common, this detector
 * REQUIRES a "passport" context keyword within 60 chars to fire.
 * Without it, false-positive rate on reference numbers, order IDs,
 * and other 9-digit strings is unacceptably high.
 *
 * Formats matched:
 *   123456789        — 9 digits (modern)
 *   A1234567B        — older letter-digit-letter format
 *   12 345 678 9     — spaced (as printed in some documents)
 */

const RE_PASSPORT_DIGITS = /\b(\d{9}|\d{2}[\s]\d{3}[\s]\d{3}[\s]\d)\b/g;
const RE_PASSPORT_ALPHA  = /\b([A-Z]\d{7}[A-Z])\b/g;
const RE_PASSPORT_CONTEXT =
  /\b(passport\s*(?:number|no\.?|#)?|travel\s*document|mrz)\b/i;

export function detectPassport(text, claimed) {
  const risks = [];

  function tryMatch(match) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) return;

    const surrounding = text.slice(Math.max(0, start - 60), end + 20);
    if (!RE_PASSPORT_CONTEXT.test(surrounding)) return;

    risks.push(makeRisk('passport', raw, start, end, 0.95));
    claimSpan(claimed, start, end);
  }

  let match;

  RE_PASSPORT_DIGITS.lastIndex = 0;
  while ((match = RE_PASSPORT_DIGITS.exec(text)) !== null) tryMatch(match);

  RE_PASSPORT_ALPHA.lastIndex = 0;
  while ((match = RE_PASSPORT_ALPHA.exec(text)) !== null) tryMatch(match);

  return risks;
}
