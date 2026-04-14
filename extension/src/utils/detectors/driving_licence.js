import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * UK Driving Licence number detector (DVLA format).
 *
 * Format: 16 characters
 *   [A-Z9]{5}  — first 5 chars of surname, padded with 9s
 *   \d{6}      — encoded DOB: decade, month (01-12 or 51-62 for female), day, year
 *   [A-Z]{2}   — first two initials of first name (padded with 9 for 1-char names)
 *   [0-9A-Z]   — arbitrary check character
 *   [A-Z]{2}   — two computer-generated letters
 *
 * Example: MORGA753116SM9IJ
 *
 * Validation:
 *   - Month digits (positions 7-8 of DOB block) must be 01-12 or 51-62
 *   - Day digits (positions 9-10) must be 01-31
 *   - Requires context keyword (driving licence / DL / DVLA) to avoid FP
 *     on other 16-char alphanumeric strings
 */

// DOB block is 6 digits: decade(1) + month(2) + day(2) + year-last(1)
// Groups: surname(5) | decade(1) | month(2) | day(2) | year(1) | initials(2) | check(1) | suffix(2)
const RE_DL = /\b([A-Z9]{5})(\d)(\d{2})(\d{2})(\d)([A-Z]{2})([0-9A-Z])([A-Z]{2})\b/g;

// Loose fallback: some surnames are 6 chars (e.g. GARCIA → GARCIA rather than GARCI).
// Only used when explicit DL context keyword is present — no DOB validation needed.
const RE_DL_LOOSE = /\b([A-Z][A-Z9]{5}\d{6}[A-Z]{2}[0-9A-Z][A-Z]{2})\b/g;

const RE_DL_CONTEXT =
  /\b(driving\s*licen[sc]e|d\.?l\.?\s*(?:number|no\.?|:)|dvla|licence\s*(?:number|no\.?)|license\s*(?:number|no\.?))\b/i;

function isValidDLDate(yearDecade, monthStr, dayStr) {
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  // Month must be 01-12 (male) or 51-62 (female, +50)
  const normMonth = month > 50 ? month - 50 : month;
  if (normMonth < 1 || normMonth > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

export function detectDrivingLicence(text, claimed) {
  const risks = [];
  let match;
  RE_DL.lastIndex = 0;

  while ((match = RE_DL.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;

    // Validate DOB section — groups: [0]=full, [1]=surname, [2]=decade, [3]=month, [4]=day
    const [, , yearDecade, monthStr, dayStr] = match;
    if (!isValidDLDate(yearDecade, monthStr, dayStr)) continue;

    // Require context — too many alphanumeric 16-char strings exist otherwise
    const surrounding = text.slice(Math.max(0, start - 100), end + 20);
    if (!RE_DL_CONTEXT.test(surrounding)) continue;

    risks.push(makeRisk('driving_licence', raw, start, end, 0.95));
    claimSpan(claimed, start, end);
  }

  // Loose fallback: 17-char format (6-char surname block) — requires explicit context
  RE_DL_LOOSE.lastIndex = 0;
  while ((match = RE_DL_LOOSE.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;

    const surrounding = text.slice(Math.max(0, start - 100), end + 20);
    if (!RE_DL_CONTEXT.test(surrounding)) continue;

    risks.push(makeRisk('driving_licence', raw, start, end, 0.90));
    claimSpan(claimed, start, end);
  }

  return risks;
}
