import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// NI: AB 12 34 56 C or CD 34 56 78 A (two letters, six digits in pairs, one letter)
// Use broad pattern + invalid prefix filter (official: exclude BG, GB, NK, KN, TN, NT, ZZ)
const RE_NI = /\b([A-Z]{2}[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?[A-D])\b/gi;

const INVALID_NI_PREFIXES = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ'];

export function detectNI(text, claimed) {
  const risks = [];
  let match;
  RE_NI.lastIndex = 0;

  while ((match = RE_NI.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const prefix = match[1].substring(0, 2).toUpperCase();
    if (INVALID_NI_PREFIXES.includes(prefix)) continue;

    risks.push(makeRisk('ni_number', match[0], start, end, 0.95));
    claimSpan(claimed, start, end);
  }

  return risks;
}
