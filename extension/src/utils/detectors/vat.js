import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// UK VAT: GB followed by 9 or 12 digits, optional spaces/dashes
const RE_VAT = /\bGB[\s\-]?\d{3}[\s\-]?\d{4}[\s\-]?\d{2}(?:[\s\-]?\d{3})?\b/gi;

export function detectVAT(text, claimed) {
  const risks = [];
  let match;
  RE_VAT.lastIndex = 0;

  while ((match = RE_VAT.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const digits = match[0].replace(/\D/g, '');
    if (digits.length !== 9 && digits.length !== 12) continue;

    risks.push(makeRisk('uk_vat', match[0], start, end, 0.97));
    claimSpan(claimed, start, end);
  }

  return risks;
}
