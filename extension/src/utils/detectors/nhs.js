import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// NHS: 3+3+4 digits with spaces or hyphens, e.g. 485 777 3456 or 485-777-3456
// Use lookahead (?=\D|$) so we match when followed by letter (e.g. 9076Postcode) — DOM can strip newlines
const RE_NHS = /\b(\d{3}[\s\-]\d{3}[\s\-]\d{4})(?=\D|$)/g;

// Context: "NHS" within 20 chars before the number boosts to 0.98
const RE_NHS_CONTEXT = /\bnhs\b/i;

export function detectNHS(text, claimed) {
  const risks = [];
  let match;
  RE_NHS.lastIndex = 0;

  while ((match = RE_NHS.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const before = text.slice(Math.max(0, start - 20), start);
    const confidence = RE_NHS_CONTEXT.test(before) ? 0.98 : 0.80;

    risks.push(makeRisk('nhs_number', match[0], start, end, confidence));
    claimSpan(claimed, start, end);
  }

  return risks;
}
