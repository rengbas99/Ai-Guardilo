import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// Sort code: 6 digits in pairs (e.g. 40-47-84 or 40 47 84)
// Account: 8 digits — allow "Account:", "Account Number:", or bare whitespace between
const RE_SORTCODE_ACCOUNT = /\b(\d{2}[\s\-]\d{2}[\s\-]\d{2})[\s\-]*(?:account(?:\s+number)?\s*:?\s*)?[\s\-]*(\d{8})(?!\d)/gi;

// Sort code only: XX-XX-XX or XX XX XX
const RE_SORTCODE = /\b(\d{2}[\s\-]\d{2}[\s\-]\d{2})(?!\d)/g;

// Account number only: 8 digits (UK standard)
const RE_ACCOUNT = /\b(\d{8})(?!\d)/g;

const RE_BANK_CONTEXT = /\b(sort\s*code|account\s*number|account\s*:?|bank|bacs|faster\s*payment)\b/i;

const RE_SORTCODE_CONTEXT = /\b(sort\s*code|bank|bacs)\b/i;
const RE_ACCOUNT_CONTEXT = /\b(account\s*number|account\s*:?|bank|bacs)\b/i;

export function detectBank(text, claimed) {
  const risks = [];
  let match;

  // 1. Combined sort code + account (highest priority)
  RE_SORTCODE_ACCOUNT.lastIndex = 0;
  while ((match = RE_SORTCODE_ACCOUNT.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const surrounding = text.slice(Math.max(0, start - 100), end + 20);
    if (!RE_BANK_CONTEXT.test(surrounding)) continue;

    risks.push(makeRisk('sortcode_account', match[0], start, end, 0.92));
    claimSpan(claimed, start, end);
  }

  // 2. Sort code only (with context)
  RE_SORTCODE.lastIndex = 0;
  while ((match = RE_SORTCODE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const before = text.slice(Math.max(0, start - 40), start);
    const after = text.slice(end, end + 20);
    const surrounding = before + match[0] + after;
    if (!RE_SORTCODE_CONTEXT.test(surrounding)) continue;

    risks.push(makeRisk('sortcode', match[0], start, end, 0.88));
    claimSpan(claimed, start, end);
  }

  // 3. Account number only (with context)
  RE_ACCOUNT.lastIndex = 0;
  while ((match = RE_ACCOUNT.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    const before = text.slice(Math.max(0, start - 40), start);
    const after = text.slice(end, end + 20);
    const surrounding = before + match[0] + after;
    if (!RE_ACCOUNT_CONTEXT.test(surrounding)) continue;

    risks.push(makeRisk('account_number', match[0], start, end, 0.88));
    claimSpan(claimed, start, end);
  }

  return risks;
}
