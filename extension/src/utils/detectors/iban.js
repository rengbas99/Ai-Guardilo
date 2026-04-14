import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// GB IBAN: GB + 2 check digits + 4-char bank code + 14 digits = 22 chars
const RE_IBAN = /\bGB\s*\d{2}\s*[A-Z]{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{2}\b/gi;

function validateIBAN(raw) {
  const s = raw.replace(/\s/g, '').toUpperCase();
  if (s.length !== 22) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const numStr = rearranged.replace(/[A-Z]/g, c => (c.charCodeAt(0) - 55).toString());
  let rem = 0;
  for (const ch of numStr) rem = (rem * 10 + parseInt(ch)) % 97;
  return rem === 1;
}

export function detectIBAN(text, claimed) {
  const risks = [];
  let m;
  RE_IBAN.lastIndex = 0;
  while ((m = RE_IBAN.exec(text)) !== null) {
    const start = m.index, end = start + m[0].length;
    if (isOverlapping(claimed, start, end)) continue;
    if (!validateIBAN(m[0])) continue;
    risks.push(makeRisk('iban', m[0], start, end, 0.99));
    claimSpan(claimed, start, end);
  }
  return risks;
}
