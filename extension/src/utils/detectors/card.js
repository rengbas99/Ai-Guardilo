import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// Card numbers: 13-16 digits with optional spaces/dashes (Visa 4xxx, Mastercard 51-55 or 2221-2720)
const RE_CARD = /\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,4}|\d{4}[\s\-]?\d{4}[\s\-]?\d{5})\b/g;

function luhnCheck(digits) {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function isVisa(digits) {
  return digits.length >= 13 && digits.length <= 16 && digits[0] === '4';
}

function isMastercard(digits) {
  if (digits.length !== 16) return false;
  const firstTwo = parseInt(digits.slice(0, 2), 10);
  const firstFour = parseInt(digits.slice(0, 4), 10);
  return (firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720);
}

export function detectCard(text, claimed) {
  const risks = [];
  let match;
  RE_CARD.lastIndex = 0;

  while ((match = RE_CARD.exec(text)) !== null) {
    const raw = match[0];
    const digits = raw.replace(/[\s\-]/g, '');
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;
    if (digits.length < 13 || digits.length > 16) continue;
    if (!luhnCheck(digits)) continue;

    const isV = isVisa(digits);
    const isM = isMastercard(digits);
    if (!isV && !isM) continue;

    risks.push(makeRisk('card_number', raw, start, end, 0.95));
    claimSpan(claimed, start, end);
  }

  return risks;
}
