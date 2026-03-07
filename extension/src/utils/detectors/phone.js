import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// UK phone: +44 or 0 prefix, various formats
// Covers: 07700 900123 | +44 7700 900123 | 020 7946 0958 | 01632 960 123
const RE_PHONE = /(?:\+44[\s\-]?|0)(?:\d[\s\-]?){9,10}\d/g;

export function detectPhone(text, claimed) {
  const risks = [];
  let match;
  RE_PHONE.lastIndex = 0;

  while ((match = RE_PHONE.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;

    risks.push(makeRisk('uk_phone', raw, start, end, 0.90));
    claimSpan(claimed, start, end);
  }

  return risks;
}
