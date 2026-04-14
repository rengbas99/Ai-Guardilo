import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * UK phone number detector.
 *
 * Improvements over v1:
 * - Validates second digit (0|1|2|3|7|8|9 only — rules out many non-phone sequences)
 * - Requires exactly 10 digits after 0 / 10 after +44 (always 11 national digits)
 * - Negative lookbehind (?<!\d) and lookahead (?!\d) prevent matching substrings
 *   of longer digit runs (e.g. IBANs, account numbers, reference codes)
 * - Explicit support for 0044 international prefix
 * - Returns LOW confidence when no context keyword found, HIGH when "mobile",
 *   "phone", "tel", "call" appears within 40 chars
 *
 * Formats covered:
 *   07700 900123  | +44 7700 900123 | 020 7946 0958 | 0044 7700 900123
 *   01632 960123  | 03069 990123    | 0808 157 0192  | (no spaces)
 */

// After the 0 or +44 prefix, valid second digits are 1,2,3,7,8,9
// (4,5,6 are not used for UK geographic/mobile/service numbers)
// Matches: 0[1-3,7-9] or +44 [1-3,7-9]
// Then exactly 9 more digit characters, separated by optional spaces/dashes
const RE_PHONE =
  /(?<!\d)(?:\+44[\s\-]?|0044[\s\-]?|0)(?:[1237]\d|8[0-9]|9[0-9])(?:[\s\-]?\d){8}(?!\d)/g;

const RE_PHONE_CONTEXT = /\b(phone|mobile|tel(?:ephone)?|call|fax|contact|number|mob)\b/i;

export function detectPhone(text, claimed) {
  const risks = [];
  let match;
  RE_PHONE.lastIndex = 0;

  while ((match = RE_PHONE.exec(text)) !== null) {
    const raw = match[0];
    const digits = raw.replace(/[\s\-+]/g, '').replace(/^44/, '0').replace(/^0044/, '0');
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;

    // Must be exactly 11 national digits
    if (digits.length !== 11) continue;

    const surrounding = text.slice(Math.max(0, start - 40), end + 10);
    const hasContext = RE_PHONE_CONTEXT.test(surrounding);
    const confidence = hasContext ? 0.93 : 0.82;

    risks.push(makeRisk('uk_phone', raw, start, end, confidence));
    claimSpan(claimed, start, end);
  }

  return risks;
}
