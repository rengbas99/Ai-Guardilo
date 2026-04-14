import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * Payment card number detector.
 *
 * Improvements over v1:
 * - Adds American Express (15 digits, 34xx/37xx prefix, 4-6-5 format)
 * - Adds Maestro/Switch (12-19 digits, 6304/6759/6761/6762/6763 prefix) — common UK debit
 * - Adds Discover (16 digits, 6011/622/644-649/65 prefix)
 * - All non-Amex paths still validated with Luhn
 * - Amex validated with Luhn (Amex uses Luhn too)
 * - Minimum digit run length tightened: Amex is 15, others 13-16
 */

// Standard 13-16 digit cards (Visa, Mastercard, Discover, Maestro 16-digit)
const RE_CARD_STD = /\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,4})\b/g;

// Amex: 4-6-5 digit groups (15 digits total)
const RE_CARD_AMEX = /\b(\d{4}[\s\-]?\d{6}[\s\-]?\d{5})\b/g;

// Long Maestro: 12-19 digits (no space variant, tighter prefix check post-match)
const RE_CARD_MAESTRO = /\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{0,3})\b/g;

function luhn(digits) {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function isVisa(d)       { return (d.length >= 13 && d.length <= 16) && d[0] === '4'; }
function isMastercard(d) {
  if (d.length !== 16) return false;
  const n2 = parseInt(d.slice(0, 2), 10);
  const n4 = parseInt(d.slice(0, 4), 10);
  return (n2 >= 51 && n2 <= 55) || (n4 >= 2221 && n4 <= 2720);
}
function isAmex(d)       { return d.length === 15 && (d.startsWith('34') || d.startsWith('37')); }
function isDiscover(d)   {
  if (d.length !== 16) return false;
  const n4 = parseInt(d.slice(0, 4), 10);
  const n3 = parseInt(d.slice(0, 3), 10);
  const n2 = parseInt(d.slice(0, 2), 10);
  return n4 === 6011 || (n3 >= 622 && n3 <= 629) || (n2 >= 64 && n2 <= 65);
}
function isMaestro(d)    {
  if (d.length < 12 || d.length > 19) return false;
  const prefixes = ['6304', '6759', '6761', '6762', '6763'];
  return prefixes.some(p => d.startsWith(p));
}

function tryCard(raw, start, end, claimed, risks) {
  const digits = raw.replace(/[\s\-]/g, '');
  if (isOverlapping(claimed, start, end)) return;
  if (!luhn(digits)) return;

  const network =
    isVisa(digits)       ? 'visa' :
    isMastercard(digits) ? 'mastercard' :
    isAmex(digits)       ? 'amex' :
    isDiscover(digits)   ? 'discover' :
    isMaestro(digits)    ? 'maestro' : null;

  if (!network) return;

  risks.push(makeRisk('card_number', raw, start, end, 0.95));
  claimSpan(claimed, start, end);
}

export function detectCard(text, claimed) {
  const risks = [];
  let match;

  // 1. Amex (4-6-5 format, 15 digits) — check first to avoid partial Std match
  RE_CARD_AMEX.lastIndex = 0;
  while ((match = RE_CARD_AMEX.exec(text)) !== null) {
    tryCard(match[0], match.index, match.index + match[0].length, claimed, risks);
  }

  // 2. Standard 13-16 digit (Visa / Mastercard / Discover / short Maestro)
  RE_CARD_STD.lastIndex = 0;
  while ((match = RE_CARD_STD.exec(text)) !== null) {
    tryCard(match[0], match.index, match.index + match[0].length, claimed, risks);
  }

  // 3. Long Maestro (17-19 digits)
  RE_CARD_MAESTRO.lastIndex = 0;
  while ((match = RE_CARD_MAESTRO.exec(text)) !== null) {
    const digits = match[0].replace(/[\s\-]/g, '');
    if (digits.length < 17) continue; // already handled by STD regex
    tryCard(match[0], match.index, match.index + match[0].length, claimed, risks);
  }

  return risks;
}
