/**
 * index.js — UK PII Detector
 * Priority order is fixed. Each detector sees the claimed set
 * from all detectors that ran before it.
 */

import { createClaimedSet } from './shared.js';
import { detectNHS } from './nhs.js';
import { detectNI } from './ni.js';
import { detectPostcode } from './postcode.js';
import { detectVAT } from './vat.js';
import { detectPhone } from './phone.js';
import { detectBank } from './bank.js';
import { detectCard } from './card.js';
import { detectEmail } from './email.js';
import { detectDrivingLicence } from './driving_licence.js';
import { detectPassport } from './passport.js';
import { detectIP } from './ip.js';
import { detectDOB } from './dob.js';
import { detectIBAN } from './iban.js';
import { detectAddress } from './address.js';
import { detectNames } from './name.js';

export { DISPLAY_LABELS, getPlaceholder, redact } from './shared.js';
export { FALSE_POSITIVES } from './name.js';

/**
 * Detect all UK PII in a plain text string.
 * Returns risks sorted by start offset.
 *
 * @param {string} text - plain text (from buildTextIndex or normalizeNewlines)
 * @returns {Array<{type, text, start, end, confidence}>}
 */
export function detectUKPII(text) {
  if (!text || typeof text !== 'string') return [];

  const claimed = createClaimedSet();
  const risks = [];

  // High-specificity structured identifiers first
  risks.push(...detectNHS(text, claimed));
  risks.push(...detectNI(text, claimed));
  risks.push(...detectPassport(text, claimed));
  risks.push(...detectDrivingLicence(text, claimed));
  risks.push(...detectVAT(text, claimed));
  risks.push(...detectBank(text, claimed));
  risks.push(...detectIBAN(text, claimed));
  risks.push(...detectCard(text, claimed));
  risks.push(...detectDOB(text, claimed));

  // Contact / network identifiers
  risks.push(...detectPhone(text, claimed));
  risks.push(...detectEmail(text, claimed));
  risks.push(...detectIP(text, claimed));

  // Location
  risks.push(...detectAddress(text, claimed));
  risks.push(...detectPostcode(text, claimed));

  // Names last
  risks.push(...detectNames(text, claimed));

  return risks.sort((a, b) => a.start - b.start);
}
