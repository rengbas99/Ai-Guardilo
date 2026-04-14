import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * UK Postcode detector.
 *
 * Improvements over v1:
 * - Accepts both spaced (SW1A 1AA) and unspaced (SW1A1AA) formats
 * - Uses literal space `[ ]?` instead of `[\s]` — avoids matching across
 *   tab/newline boundaries that look like postcodes
 * - Validates inward code first character is 0-9 (always a digit)
 * - Context-based confidence: "postcode" / "post code" / "address" label nearby
 *   raises to 0.99; bare match stays at 0.85 (was 0.88 — lowered to reflect
 *   higher false-positive rate of unspaced format)
 *
 * Formats covered:
 *   AN NAA   e.g. M1 1AE
 *   ANN NAA  e.g. M60 1NW
 *   AAN NAA  e.g. CR2 6XH
 *   AANN NAA e.g. DN55 1PT
 *   ANA NAA  e.g. W1A 1HQ
 *   AANA NAA e.g. EC1A 1BB
 *
 * Outward code: [A-Z]{1,2}\d[A-Z\d]?
 * Inward code:  \d[A-Z]{2}
 */

// Lookarounds instead of \b — avoids false rejects when postcode follows
// punctuation like commas ("London, SE1 7EH") or is preceded by an underscore.
// (?<![A-Z0-9]) with /i also excludes a-z, effectively requiring a non-alnum boundary.
const RE_POSTCODE = /(?<![A-Z0-9])([A-Z]{1,2}\d[A-Z\d]?[ ]?\d[A-Z]{2})/gi;

const RE_POSTCODE_CONTEXT = /\b(postcode|post\s+code|address|zip(?:\s+code)?)\b/i;

export function detectPostcode(text, claimed) {
  const risks = [];
  let match;
  RE_POSTCODE.lastIndex = 0;

  while ((match = RE_POSTCODE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    // Inward code first char must be a digit (it always is in valid UK postcodes)
    const raw = match[0].replace(' ', '');
    const inwardStart = raw.length - 3;
    if (!/\d/.test(raw[inwardStart])) continue;

    const surrounding = text.slice(Math.max(0, start - 50), end + 10);
    const confidence = RE_POSTCODE_CONTEXT.test(surrounding) ? 0.99 : 0.85;

    risks.push(makeRisk('uk_postcode', match[0], start, end, confidence));
    claimSpan(claimed, start, end);
  }

  return risks;
}
