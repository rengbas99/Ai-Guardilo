import { claimSpan, isOverlapping, makeRisk } from './shared.js';

const MONTHS = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const RE_DMY      = /\b(0?[1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](\d{4})(?!\d)/g;
const RE_WRITTEN  = new RegExp(`\\b(0?[1-9]|[12]\\d|3[01])[ ](${MONTHS})[ ](\\d{4})(?!\\d)`, 'gi');
const RE_ISO      = /\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?!\d)/g;
const RE_DOB_CTX  = /\b(date\s*of\s*birth|d\.?o\.?b\.?|born|birthday|dob)\b/i;

function isPlausibleBirthYear(y) { const n = parseInt(y, 10); return n >= 1900 && n <= 2015; }

function tryAdd(raw, start, end, year, text, claimed, risks) {
  if (isOverlapping(claimed, start, end)) return;
  const ctx = text.slice(Math.max(0, start - 40), end + 10);
  const hasCtx = RE_DOB_CTX.test(ctx);
  if (!hasCtx && !isPlausibleBirthYear(year)) return;
  risks.push(makeRisk('date_of_birth', raw, start, end, hasCtx ? 0.97 : 0.78));
  claimSpan(claimed, start, end);
}

export function detectDOB(text, claimed) {
  const risks = [];
  let m;

  RE_DMY.lastIndex = 0;
  while ((m = RE_DMY.exec(text)) !== null)
    tryAdd(m[0], m.index, m.index + m[0].length, m[3], text, claimed, risks);

  RE_WRITTEN.lastIndex = 0;
  while ((m = RE_WRITTEN.exec(text)) !== null)
    tryAdd(m[0], m.index, m.index + m[0].length, m[3], text, claimed, risks);

  RE_ISO.lastIndex = 0;
  while ((m = RE_ISO.exec(text)) !== null)
    tryAdd(m[0], m.index, m.index + m[0].length, m[1], text, claimed, risks);

  return risks;
}
