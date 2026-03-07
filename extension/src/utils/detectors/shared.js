/**
 * shared.js
 * Claimed span registry — prevents two detectors claiming the same text.
 */

export function createClaimedSet() {
  return new Set(); // stores "start:end" strings
}

export function claimSpan(claimed, start, end) {
  claimed.add(`${start}:${end}`);
}

export function isOverlapping(claimed, start, end) {
  for (const entry of claimed) {
    const [cs, ce] = entry.split(':').map(Number);
    if (!(end <= cs || start >= ce)) return true;
  }
  return false;
}

export function makeRisk(type, text, start, end, confidence) {
  return { type, text, start, end, confidence };
}

export const DISPLAY_LABELS = {
  nhs_number: 'NHS Number',
  ni_number: 'NI Number',
  uk_postcode: 'UK Postcode',
  uk_vat: 'UK VAT Number',
  sortcode_account: 'Bank Details',
  sortcode: 'Sort Code',
  account_number: 'Account Number',
  card_number: 'Card Number',
  uk_phone: 'Phone Number',
  email: 'Email Address',
  name: 'Name',
};

// Placeholder mapping for redaction (supports both new and legacy type names)
const PLACEHOLDERS = {
  nhs_number: (i) => `[NHS_NUMBER_${i}]`,
  ni_number: (i) => `[NI_NUMBER_${i}]`,
  uk_postcode: (i) => `[POSTAL_CODE_${i}]`,
  postal_code: (i) => `[POSTAL_CODE_${i}]`,
  postcode: (i) => `[POSTAL_CODE_${i}]`,
  uk_vat: (i) => `[VAT_${i}]`,
  vat: (i) => `[VAT_${i}]`,
  sortcode_account: (i) => `[BANK_${i}]`,
  sortcode: (i) => `[SORT_CODE_${i}]`,
  account_number: (i) => `[ACCOUNT_${i}]`,
  card_number: (i) => `[CARD_${i}]`,
  uk_phone: (i) => `[PHONE_${i}]`,
  phone: (i) => `[PHONE_${i}]`,
  email: (i) => `[EMAIL_${i}]`,
  name: (i) => `[NAME_${i}]`,
  address: (i) => `[ADDRESS_${i}]`,
};

export function getPlaceholder(type, index) {
  const fn = PLACEHOLDERS[type];
  return fn ? fn(index) : `[PII_${index}]`;
}

/**
 * Redact text by replacing risk spans with placeholders.
 * @param {string} text - Input text
 * @param {Array} risks - Array of { type, text, start, end }
 * @returns {string} Redacted text
 */
export function redact(text, risks) {
  if (!risks || risks.length === 0) return text;

  const byPosition = [...risks].sort((a, b) => a.start - b.start);
  const counters = {};
  const indexMap = new Map();

  for (const risk of byPosition) {
    counters[risk.type] = (counters[risk.type] || 0) + 1;
    indexMap.set(risk, getPlaceholder(risk.type, counters[risk.type]));
  }

  const sortedRisks = [...risks].sort((a, b) => b.start - a.start);
  let redacted = text;
  for (const risk of sortedRisks) {
    const placeholder = indexMap.get(risk);
    redacted = redacted.substring(0, risk.start) + placeholder + redacted.substring(risk.end);
  }
  return redacted;
}
