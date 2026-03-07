import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// UK postcode: covers all valid formats e.g. SW1A 1AA, E1 6AN, M60 1NW
const RE_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?[\s]\d[A-Z]{2})\b/gi;

const RE_POSTCODE_CONTEXT = /\b(postcode|post\s+code|zip)\b/i;

export function detectPostcode(text, claimed) {
  const risks = [];
  let match;
  RE_POSTCODE.lastIndex = 0;

  while ((match = RE_POSTCODE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const surrounding = text.slice(Math.max(0, start - 20), end + 10);
    const confidence = RE_POSTCODE_CONTEXT.test(surrounding) ? 0.99 : 0.88;

    risks.push(makeRisk('uk_postcode', match[0], start, end, confidence));
    claimSpan(claimed, start, end);
  }

  return risks;
}
