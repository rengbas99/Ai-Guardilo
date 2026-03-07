import { claimSpan, isOverlapping, makeRisk } from './shared.js';

export const FALSE_POSITIVES = new Set([
  'patient report', 'medical report', 'discharge summary',
  'referral letter', 'clinical notes', 'consultation notes',
  'lab results', 'test results',
  'patient name', 'full name', 'first name', 'last name', 'surname',
  'date of birth', 'nhs number', 'phone number', 'email address',
  'home address', 'post code', 'postcode', 'emergency contact',
  'contact name', 'referred by', 'referring gp', 'gp name',
  'next of kin', 'relationship to patient',
  'dear sir', 'dear madam', 'dear patient',
  'best regards', 'kind regards', 'yours sincerely',
  'thank you', 'please find', 'please note',
  'see attached', 'see below',
  'medical centre', 'health centre', 'nhs trust',
  'high street', 'reference number',
  'confidential', 'private', 'restricted',
  'name', 'address', 'email', 'phone', 'dob', 'gp',
  'report', 'number', 'reference', 'details',
  'patient', 'medical', 'clinical', 'emergency',
  'referred', 'contact', 'department', 'section',
  'dear', 'regards', 'please', 'attached',
  'applicable', 'required', 'internal', 'sensitive',
  'line one', 'line two', 'line three', 'has no', 'no pii',
  'hi sarah', 'hi john', 'hi jane',
  'sort code', 'account number',
]);

// Title + name (Dr Ahmed, Mrs Elizabeth Clarke) — high confidence, bypasses FALSE_POSITIVES
const RE_TITLE_NAME = /\b(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g;

// Use [ \t]+ not \s+ so we don't match across newlines (e.g. "Alice Thornton\nEmail")
// Lookahead (?=[A-Z]|\s|$) allows match when name is followed by capital (e.g. "ThorntonEmail:") or space/newline
const RE_NAME = /\b([A-Z][a-z]{1,}(?:[ \t]+[A-Z][a-z]{1,}){1,2})(?=[A-Z]|[ \t\n]|$)/g;

const RE_NAME_CONTEXT = /\b(full\s*name\s*[:\-]?|name\s*[:\-]|named?|patient\s*[:\-]?|from|to|dear|signed?\s*by|referred\s*by)\s*$/i;

// Labels that often follow a name (Email:, Phone:, etc.) — boosts confidence
const LABEL_LOOKAHEAD = /^\s*(email|phone|address|dob|date)\s*[:\-]/i;

const COMMON_WORDS = new Set([
  'has', 'no', 'is', 'it', 'in', 'on', 'at', 'to', 'of', 'or', 'and',
  'the', 'a', 'an', 'be', 'was', 'are', 'for', 'with', 'this', 'that',
  'line', 'page', 'step', 'part', 'item', 'note', 'see', 'per',
]);

export function detectNames(text, claimed) {
  const risks = [];
  let match;

  // Title-prefixed names first (Dr Ahmed, Mrs Elizabeth Clarke) — not skipped by "dear" etc.
  RE_TITLE_NAME.lastIndex = 0;
  while ((match = RE_TITLE_NAME.exec(text)) !== null) {
    const raw = match[0].trim();
    const start = match.index;
    const end = start + raw.length;
    if (isOverlapping(claimed, start, end)) continue;
    risks.push(makeRisk('name', raw, start, end, 0.92));
    claimSpan(claimed, start, end);
  }

  RE_NAME.lastIndex = 0;
  while ((match = RE_NAME.exec(text)) !== null) {
    const raw = match[0].trim();
    const lower = raw.toLowerCase();
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;
    if (FALSE_POSITIVES.has(lower)) continue;

    const words = lower.split(/\s+/);
    if (words.every((w) => FALSE_POSITIVES.has(w))) continue;
    if (words.some((w) => FALSE_POSITIVES.has(w))) continue;

    if (words.length === 2 && words.some((w) => COMMON_WORDS.has(w))) continue;

    const before = text.slice(Math.max(0, start - 40), start);
    const after = text.slice(end, end + 30);
    const hasContext = RE_NAME_CONTEXT.test(before);
    const hasLabelAfter = LABEL_LOOKAHEAD.test(after);
    const confidence = hasContext ? 0.88 : hasLabelAfter ? 0.85 : 0.70;

    // Skip single-word matches without context; always include 2+ word names
    if (words.length === 1 && confidence < 0.75 && !hasLabelAfter) continue;

    risks.push(makeRisk('name', raw, start, end, confidence));
    claimSpan(claimed, start, end);
  }

  return risks;
}
