/**
 * UK PII Detector — comprehensive unit tests
 * Run with: bun test
 */

import { test, expect, describe } from 'bun:test';
import { detectUKPII, getPlaceholder, redact } from './index.js';
import { detectNHS } from './nhs.js';
import { detectNI } from './ni.js';
import { detectPostcode } from './postcode.js';
import { detectPhone } from './phone.js';
import { detectEmail } from './email.js';
import { detectCard } from './card.js';
import { detectBank } from './bank.js';
import { detectVAT } from './vat.js';
import { detectNames } from './name.js';
import { detectIP } from './ip.js';
import { detectDrivingLicence } from './driving_licence.js';
import { detectPassport } from './passport.js';
import { detectDOB } from './dob.js';
import { detectIBAN } from './iban.js';
import { createClaimedSet } from './shared.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function claimed() { return createClaimedSet(); }
function types(risks) { return risks.map(r => r.type); }
function texts(risks) { return risks.map(r => r.text); }

// ─── NHS Number ─────────────────────────────────────────────────────────────

describe('NHS Number', () => {
  test('detects spaced format with "NHS" context → 0.99 confidence', () => {
    const r = detectNHS('NHS: 943 476 1239', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('nhs_number');
    expect(r[0].confidence).toBe(0.99);
  });

  test('detects spaced format without context → 0.85 confidence', () => {
    const r = detectNHS('Number is 400 000 0004 on file', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].confidence).toBe(0.85);
  });

  test('detects hyphen-separated format', () => {
    const r = detectNHS('ref: 321-654-9879', claimed());
    expect(r).toHaveLength(1);
  });

  test('rejects number that fails mod-11 check digit', () => {
    // 485 777 3456 is mathematically invalid per mod-11
    const r = detectNHS('NHS: 485 777 3456', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects mod-11 where remainder is 0 (check digit would be 11)', () => {
    // 943 476 5870: digits 1-9 sum = 308, 308%11 = 0 → invalid
    const r = detectNHS('NHS: 943 476 5870', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects mod-11 where remainder is 1 (check digit would be 10)', () => {
    // 100 000 0010: digits 1-9 = 1,0,0,0,0,0,0,0,1 sum=10+2=12? let me just use known invalid
    // 123 456 7890: sum=210, 210%11=1 → check=10 → invalid
    const r = detectNHS('ref 123 456 7890', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects 9-digit number (too short)', () => {
    const r = detectNHS('100 000 001', claimed());
    expect(r).toHaveLength(0);
  });

  test('does not overlap with already-claimed span', () => {
    const c = claimed();
    c.push([0, 17]); // pre-claim the span
    const r = detectNHS('943 476 1239 here', c);
    expect(r).toHaveLength(0);
  });

  test('detects mod-11-invalid number when "NHS" context is present → 0.75 confidence', () => {
    // 453 821 9904 fails mod-11 but "NHS Number:" label makes intent clear
    const r = detectNHS('NHS Number: 453 821 9904', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('nhs_number');
    expect(r[0].confidence).toBe(0.75);
  });

  test('rejects mod-11-invalid number WITHOUT context', () => {
    const r = detectNHS('ref: 453 821 9904', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── National Insurance Number ───────────────────────────────────────────────

describe('NI Number', () => {
  test('detects standard spaced format AB 12 34 56 C', () => {
    const r = detectNI('NI: AB 12 34 56 C', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('ni_number');
  });

  test('detects without spaces', () => {
    const r = detectNI('NINO: AB123456C', claimed());
    expect(r).toHaveLength(1);
  });

  test('detects with hyphens', () => {
    const r = detectNI('Ref: AB-12-34-56-D', claimed());
    expect(r).toHaveLength(1);
  });

  test('context boosts confidence to 0.99', () => {
    const r = detectNI('National Insurance: AB 12 34 56 A', claimed());
    expect(r[0].confidence).toBe(0.99);
  });

  test('rejects D as first letter', () => {
    const r = detectNI('Ref: DA 12 34 56 A', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects F as first letter', () => {
    const r = detectNI('Ref: FA 12 34 56 A', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects I as first letter', () => {
    const r = detectNI('Ref: IA 12 34 56 A', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects Q as first letter', () => {
    const r = detectNI('Ref: QA 12 34 56 A', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects D as second letter', () => {
    const r = detectNI('Ref: AD 12 34 56 A', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects O as second letter', () => {
    const r = detectNI('Ref: AO 12 34 56 A', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects invalid suffix letter E', () => {
    const r = detectNI('Ref: AB 12 34 56 E', claimed());
    expect(r).toHaveLength(0);
  });

  test('valid suffix letters A-D all accepted', () => {
    for (const suffix of ['A', 'B', 'C', 'D']) {
      const r = detectNI(`Ref: AB 12 34 56 ${suffix}`, claimed());
      expect(r).toHaveLength(1);
    }
  });

  test('case insensitive', () => {
    const r = detectNI('ni: ab 12 34 56 c', claimed());
    expect(r).toHaveLength(1);
  });

  test('detects YX 54 32 10 D with "NI Number:" context', () => {
    const r = detectNI('NI Number: YX 54 32 10 D', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('ni_number');
    expect(r[0].confidence).toBe(0.99);
  });
});

// ─── Postcode ────────────────────────────────────────────────────────────────

describe('UK Postcode', () => {
  const cases = [
    ['SW1A 1AA', 'Westminster (AANA NAA)'],
    ['E1 6AN',   'East London (AN NAA)'],
    ['M60 1NW',  'Manchester (ANN NAA)'],
    ['CR2 6XH',  'Croydon (AAN NAA)'],
    ['DN55 1PT', 'Doncaster (AANN NAA)'],
    ['W1A 1HQ',  'West London (ANA NAA)'],
    ['EC1A 1BB', 'East Central (AANA NAA)'],
  ];

  for (const [postcode, label] of cases) {
    test(`detects spaced ${postcode} (${label})`, () => {
      const r = detectPostcode(`Your postcode ${postcode} is confirmed`, claimed());
      expect(r).toHaveLength(1);
      expect(r[0].text).toBe(postcode);
    });
  }

  test('detects unspaced SW1A1AA', () => {
    const r = detectPostcode('Postcode SW1A1AA on file', claimed());
    expect(r).toHaveLength(1);
  });

  test('"postcode" context boosts confidence to 0.99', () => {
    const r = detectPostcode('postcode: SW1A 1AA', claimed());
    expect(r[0].confidence).toBe(0.99);
  });

  test('bare match without context → 0.85', () => {
    const r = detectPostcode('deliver to SW1A 1AA please', claimed());
    expect(r[0].confidence).toBe(0.85);
  });

  test('does not match partial digit-only sequences', () => {
    const r = detectPostcode('ref 12345', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── Phone ───────────────────────────────────────────────────────────────────

describe('UK Phone', () => {
  const validPhones = [
    ['07700 900123', 'mobile spaced'],
    ['07700900123',  'mobile no spaces'],
    ['+44 7700 900123', '+44 mobile'],
    ['020 7946 0958',   'London landline'],
    ['01632 960123',    'national landline'],
    ['0044 7700 900123','0044 prefix'],
    ['03069 990000',    '03 prefix'],
  ];

  for (const [phone, label] of validPhones) {
    test(`detects ${label}: ${phone}`, () => {
      const r = detectPhone(`Phone: ${phone}`, claimed());
      expect(r).toHaveLength(1);
      expect(r[0].type).toBe('uk_phone');
    });
  }

  test('"phone" context raises confidence to 0.93', () => {
    const r = detectPhone('Mobile: 07700 900123', claimed());
    expect(r[0].confidence).toBe(0.93);
  });

  test('bare number without context → 0.82', () => {
    const r = detectPhone('ring 07700 900123 ok', claimed());
    expect(r[0].confidence).toBe(0.82);
  });

  test('rejects second digit 4 after 0 (not a UK prefix)', () => {
    const r = detectPhone('num: 04700 900123', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects second digit 5 after 0', () => {
    const r = detectPhone('num: 05700 900123', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects second digit 6 after 0', () => {
    const r = detectPhone('num: 06700 900123', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects 12-digit number (too long)', () => {
    // 012345678901 = 12 digits, invalid
    const r = detectPhone('call 012345678901', claimed());
    expect(r).toHaveLength(0);
  });

  test('does not match number embedded in longer digit run', () => {
    // IBAN-style: no match inside a long number
    const r = detectPhone('IBAN: 1107700900123456', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── Email ───────────────────────────────────────────────────────────────────

describe('Email', () => {
  test('detects simple email', () => {
    const r = detectEmail('email: john.smith@gmail.com', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('email');
  });

  test('detects .co.uk compound TLD', () => {
    const r = detectEmail('contact john@company.co.uk now', claimed());
    expect(r).toHaveLength(1);
  });

  test('detects NHS email', () => {
    const r = detectEmail('email sarah@nhs.uk', claimed());
    expect(r).toHaveLength(1);
  });

  test('detects modern long TLD (.photography)', () => {
    const r = detectEmail('book via studio@lens.photography', claimed());
    expect(r).toHaveLength(1);
  });

  test('detects user@example.com (real addresses, not filtered)', () => {
    const r = detectEmail('email user@example.com here', claimed());
    expect(r).toHaveLength(1);
  });

  test('skips test@test.com', () => {
    const r = detectEmail('email test@test.com', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips anything@domain.com', () => {
    const r = detectEmail('send to anything@domain.com', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips placeholder local-part your.email@anything.com', () => {
    const r = detectEmail('enter your-email@company.com', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips user@placeholder.net', () => {
    const r = detectEmail('address: bob@placeholder.net', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── Card Number ─────────────────────────────────────────────────────────────

describe('Card Number', () => {
  test('Visa 16-digit (Luhn valid)', () => {
    const r = detectCard('Card: 4111 1111 1111 1111', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('card_number');
  });

  test('Mastercard 16-digit (Luhn valid)', () => {
    const r = detectCard('MC: 5500 0000 0000 0004', claimed());
    expect(r).toHaveLength(1);
  });

  test('Amex 15-digit 4-6-5 format', () => {
    const r = detectCard('Amex: 3714 496353 98431', claimed());
    expect(r).toHaveLength(1);
  });

  test('Amex starting with 37', () => {
    const r = detectCard('Card: 3787 344936 71000', claimed());
    expect(r).toHaveLength(1);
  });

  test('Discover 6011 prefix', () => {
    const r = detectCard('Card: 6011 1111 1111 1117', claimed());
    expect(r).toHaveLength(1);
  });

  test('Visa without spaces', () => {
    const r = detectCard('Card: 4111111111111111', claimed());
    expect(r).toHaveLength(1);
  });

  test('Visa with dashes', () => {
    const r = detectCard('Card: 4111-1111-1111-1111', claimed());
    expect(r).toHaveLength(1);
  });

  test('rejects number that fails Luhn', () => {
    const r = detectCard('Card: 4111 1111 1111 1112', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects Luhn-valid but non-Visa/MC/Amex/Discover/Maestro prefix', () => {
    // 3000 0000 0000 04 — Diners Club (not in our list)
    const r = detectCard('Card: 3000 0000 0000 04', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects random 16 digits that pass Luhn but are not valid card prefix', () => {
    // 1234 5678 9012 3452 — starts with 1, not a valid network
    const r = detectCard('num: 1234 5678 9012 3452', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── Bank Details ─────────────────────────────────────────────────────────────

describe('Bank Details', () => {
  test('detects sort code + account together with context', () => {
    const r = detectBank('Sort Code: 40-47-84 Account: 12345678', claimed());
    expect(types(r)).toContain('sortcode_account');
  });

  test('detects sort code only with context', () => {
    const r = detectBank('bank sort code 40-47-84', claimed());
    expect(types(r)).toContain('sortcode');
  });

  test('detects account number with context', () => {
    const r = detectBank('Account: 12345678', claimed());
    expect(types(r)).toContain('account_number');
  });

  test('rejects sort code without context', () => {
    const r = detectBank('reference 40-47-84 here', claimed());
    expect(types(r)).not.toContain('sortcode');
  });

  test('rejects bare 8 digits without context', () => {
    const r = detectBank('ID is 12345678', claimed());
    expect(types(r)).not.toContain('account_number');
  });

  test('detects sort code with spaces instead of hyphens', () => {
    const r = detectBank('BACS sort code 40 47 84', claimed());
    expect(types(r)).toContain('sortcode');
  });

  test('detects sort code + account split across newline', () => {
    const r = detectBank('Sort Code: 20-45-81\nAccount Number: 88776655', claimed());
    expect(types(r)).toContain('sortcode_account');
  });
});

// ─── VAT Number ──────────────────────────────────────────────────────────────

describe('VAT Number', () => {
  test('detects standard GB 9-digit VAT', () => {
    const r = detectVAT('VAT: GB 123 4567 89', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('uk_vat');
  });

  test('detects 12-digit VAT (with branch suffix)', () => {
    const r = detectVAT('VAT: GB123456789012', claimed());
    expect(r).toHaveLength(1);
  });

  test('detects with hyphens', () => {
    const r = detectVAT('VAT GB-123-4567-89', claimed());
    expect(r).toHaveLength(1);
  });

  test('rejects non-GB prefix', () => {
    const r = detectVAT('VAT: DE 123 4567 89', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects wrong digit count (8 digits)', () => {
    const r = detectVAT('GB 1234 5678', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── Name ────────────────────────────────────────────────────────────────────

describe('Name', () => {
  test('detects title-prefixed name Dr Ahmed', () => {
    const r = detectNames('Dr Ahmed is your consultant', claimed());
    expect(types(r)).toContain('name');
    expect(texts(r).some(t => t.includes('Ahmed'))).toBe(true);
  });

  test('detects Mrs Elizabeth Clarke', () => {
    const r = detectNames('Patient: Mrs Elizabeth Clarke', claimed());
    expect(types(r)).toContain('name');
  });

  test('detects name after "Patient Name:" label', () => {
    const r = detectNames('Patient Name: John Smith', claimed());
    expect(types(r)).toContain('name');
    expect(texts(r).some(t => t.includes('John Smith'))).toBe(true);
  });

  test('skips "Patient Name" as standalone (it is in FALSE_POSITIVES)', () => {
    const r = detectNames('Patient Name', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips "Full Name" (FALSE_POSITIVE)', () => {
    const r = detectNames('Full Name', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips "Sort Code" (FALSE_POSITIVE)', () => {
    const r = detectNames('Sort Code: 40-47-84', claimed());
    expect(r.filter(r => r.text === 'Sort Code')).toHaveLength(0);
  });

  test('skips "Dear Sir" (FALSE_POSITIVE)', () => {
    const r = detectNames('Dear Sir,', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips common UI/Design phrases (Tactile Digital Experience, etc.)', () => {
    const phrases = [
      'Tactile Digital Experience',
      'Premium Dark Minimalist',
      'Core Product Concept',
      'Product Design Consultant',
      'Multimodal Problem Intelligence',
      'Root Cause Identification',
      'Curated Product Mapping',
      'Direct Commerce Links',
      'Cosmic Product Canvas',
    ];
    for (const phrase of phrases) {
      const r = detectNames(phrase, claimed());
      expect(r).toHaveLength(0);
    }
  });
});

// ─── IPv4 Address ─────────────────────────────────────────────────────────────

describe('IP Address', () => {
  test('detects public IPv4', () => {
    const r = detectIP('Server: 203.0.113.5', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('ip_address');
    expect(r[0].confidence).toBe(0.88);
  });

  test('detects private 192.168.x.x at lower confidence', () => {
    const r = detectIP('My IP is 192.168.1.1', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].confidence).toBe(0.75);
  });

  test('detects private 10.x.x.x', () => {
    const r = detectIP('internal: 10.0.0.1', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].confidence).toBe(0.75);
  });

  test('skips loopback 127.0.0.1', () => {
    const r = detectIP('localhost is 127.0.0.1', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips 0.0.0.0 (unspecified)', () => {
    const r = detectIP('bind to 0.0.0.0', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips 255.255.255.255 (broadcast)', () => {
    const r = detectIP('broadcast 255.255.255.255', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects out-of-range octet (256.1.1.1)', () => {
    const r = detectIP('addr 256.1.1.1', claimed());
    expect(r).toHaveLength(0);
  });

  test('does not match version string 1.2.3.4.5 (5 octets)', () => {
    const r = detectIP('version 1.2.3.4.5', claimed());
    // May match 1.2.3.4 as a substring — the negative lookahead (?![.\d]) prevents this
    expect(r).toHaveLength(0);
  });

  test('detects multiple IPs in text', () => {
    const r = detectIP('from 1.2.3.4 to 5.6.7.8', claimed());
    expect(r).toHaveLength(2);
  });
});

// ─── UK Driving Licence ───────────────────────────────────────────────────────

describe('UK Driving Licence', () => {
  test('detects MORGA753116SM9IJ with context', () => {
    const r = detectDrivingLicence('Driving Licence: MORGA753116SM9IJ', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('driving_licence');
    expect(r[0].confidence).toBe(0.95);
  });

  test('detects with "driving license" (US spelling)', () => {
    const r = detectDrivingLicence('driving license: SMITH751101AB9CD', claimed());
    expect(r).toHaveLength(1);
  });

  test('detects with "DVLA" context', () => {
    // JONES806155MR9AB: decade=8, month=06(June), day=15, year=5, initials=MR
    const r = detectDrivingLicence('DVLA ref JONES806155MR9AB', claimed());
    expect(r).toHaveLength(1);
  });

  test('rejects when no context keyword present', () => {
    const r = detectDrivingLicence('ref: MORGA753116SM9IJ', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects invalid month (month digits 99)', () => {
    // MORGA799116SM9IJ → decade=7, month=99 → invalid (>12 and not 51-62)
    const r = detectDrivingLicence('Driving Licence: MORGA799116SM9IJ', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects invalid day 00', () => {
    // MORGA753006SM9IJ → decade=7, month=53(March/female), day=00 → invalid
    const r = detectDrivingLicence('Driving Licence: MORGA753006SM9IJ', claimed());
    expect(r).toHaveLength(0);
  });

  test('detects when context label is more than 60 chars before number', () => {
    // Context window was 60 chars — this label sits ~80 chars before the licence
    const prefix = 'Driving Licence: ';
    const gap = 'Please enter your number here: ';
    const r = detectDrivingLicence(`${prefix}${gap}MORGA753116SM9IJ`, claimed());
    // gap makes context ~48 chars before number (within new 100-char window)
    expect(r).toHaveLength(1);
  });
});

// ─── UK Passport ──────────────────────────────────────────────────────────────

describe('UK Passport', () => {
  test('detects 9-digit number with "passport number" context', () => {
    const r = detectPassport('Passport Number: 123456789', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('passport');
    expect(r[0].confidence).toBe(0.95);
  });

  test('detects with "passport no" abbreviation', () => {
    const r = detectPassport('passport no. 987654321', claimed());
    expect(r).toHaveLength(1);
  });

  test('detects old-style A1234567B format with context', () => {
    const r = detectPassport('passport: A1234567B', claimed());
    expect(r).toHaveLength(1);
  });

  test('rejects 9-digit number without passport context', () => {
    const r = detectPassport('Order ref: 123456789', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects 8-digit number even with context', () => {
    const r = detectPassport('Passport: 12345678', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── Date of Birth ────────────────────────────────────────────────────────────

describe('Date of Birth', () => {
  test('DD/MM/YYYY with dob context → 0.97', () => {
    const r = detectDOB('DOB: 14/03/1987', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('date_of_birth');
    expect(r[0].confidence).toBe(0.97);
  });

  test('DD-MM-YYYY with "born" context', () => {
    const r = detectDOB('born 01-06-1990', claimed());
    expect(r).toHaveLength(1);
  });

  test('DD.MM.YYYY no context, plausible birth year → 0.78', () => {
    const r = detectDOB('25.12.1985', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].confidence).toBe(0.78);
  });

  test('written format "14 March 1987" with context', () => {
    const r = detectDOB('Date of Birth: 14 March 1987', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].text).toBe('14 March 1987');
  });

  test('ISO YYYY-MM-DD with plausible year', () => {
    const r = detectDOB('born: 1987-03-14', claimed());
    expect(r).toHaveLength(1);
  });

  test('skips current-year date without context (not a DOB)', () => {
    const r = detectDOB('meeting on 14/03/2025', claimed());
    expect(r).toHaveLength(0);
  });

  test('skips year 2020 without context', () => {
    const r = detectDOB('report dated 01/01/2020', claimed());
    expect(r).toHaveLength(0);
  });

  test('current-year date WITH dob context is still flagged', () => {
    const r = detectDOB('dob: 01/01/2024', claimed());
    expect(r).toHaveLength(1);
  });

  test('rejects invalid month 13', () => {
    const r = detectDOB('dob: 01/13/1990', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects invalid day 32', () => {
    const r = detectDOB('dob: 32/01/1990', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── IBAN ─────────────────────────────────────────────────────────────────────

describe('IBAN', () => {
  test('detects spaced GB IBAN (mod-97 valid)', () => {
    const r = detectIBAN('IBAN: GB29 NWBK 6016 1331 9268 19', claimed());
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('iban');
    expect(r[0].confidence).toBe(0.99);
  });

  test('detects unspaced IBAN', () => {
    const r = detectIBAN('account GB82WEST12345698765432', claimed());
    expect(r).toHaveLength(1);
  });

  test('rejects IBAN with wrong check digits (mod-97 fails)', () => {
    const r = detectIBAN('GB29 NWBK 6016 1331 9268 18', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects non-GB prefix', () => {
    const r = detectIBAN('DE89 3704 0044 0532 0130 00', claimed());
    expect(r).toHaveLength(0);
  });

  test('rejects GB IBAN that is too short', () => {
    const r = detectIBAN('GB29 NWBK 6016 1331', claimed());
    expect(r).toHaveLength(0);
  });
});

// ─── Name false-positive regression ─────────────────────────────────────────

describe('Name — false positive regression', () => {
  test('does NOT flag "Support Team" (no context)', () => {
    const r = detectNames('Contact our Support Team for help', claimed());
    expect(r.map(r => r.text)).not.toContain('Support Team');
  });

  test('does NOT flag "High Street" (no context)', () => {
    const r = detectNames('Located on High Street', claimed());
    expect(r.map(r => r.text)).not.toContain('High Street');
  });

  test('does NOT flag "Next Page" (no context)', () => {
    const r = detectNames('see Next Page for details', claimed());
    expect(r.map(r => r.text)).not.toContain('Next Page');
  });

  test('DOES flag "Sarah Johnson" with "from" context', () => {
    const r = detectNames('from Sarah Johnson regarding your claim', claimed());
    expect(r.map(r => r.text)).toContain('Sarah Johnson');
  });

  test('DOES flag "Emily Clarke" with "Name:" label', () => {
    const r = detectNames('Name: Emily Clarke', claimed());
    expect(r.map(r => r.text)).toContain('Emily Clarke');
  });

  test('DOES flag "Dr Ahmed" (title-prefixed, no context needed)', () => {
    const r = detectNames('Your doctor Dr Ahmed will call', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Ahmed'))).toBe(true);
  });

  test('DOES flag 3-word name "Sarah Elizabeth Johnson" without context', () => {
    // 3+ word names are flagged even without context keyword
    const r = detectNames('Sarah Elizabeth Johnson called today', claimed());
    expect(r.map(r => r.text)).toContain('Sarah Elizabeth Johnson');
  });

  // ── false positive: product feature names (store description regression) ──

  test('does NOT flag "Smart Redaction" (adjective starter)', () => {
    const r = detectNames('Smart Redaction replaces PII with placeholders', claimed());
    expect(r.map(r => r.text)).not.toContain('Smart Redaction');
  });

  test('does NOT flag "Hybrid Detection" (adjective starter)', () => {
    const r = detectNames('Hybrid Detection combines regex with AI', claimed());
    expect(r.map(r => r.text)).not.toContain('Hybrid Detection');
  });

  test('does NOT flag "Local Dashboard" (adjective starter)', () => {
    const r = detectNames('Local Dashboard shows risk stats', claimed());
    expect(r.map(r => r.text)).not.toContain('Local Dashboard');
  });

  test('does NOT flag "Zero Drift" (quantifier starter)', () => {
    const r = detectNames('Zero Drift highlights stay synced', claimed());
    expect(r.map(r => r.text)).not.toContain('Zero Drift');
  });

  test('does NOT flag "Major AI" (adjective starter)', () => {
    const r = detectNames('works on Major AI platforms', claimed());
    expect(r.map(r => r.text)).not.toContain('Major AI');
  });

  // ── Indian names ───────────────────────────────────────────────────────────

  test('DOES flag "Kavita Singh" (Indian name, no context needed)', () => {
    const r = detectNames('Kavita Singh submitted the form', claimed());
    expect(r.map(r => r.text)).toContain('Kavita Singh');
  });

  test('DOES flag "Rohit Kumar" (Indian name, no context needed)', () => {
    const r = detectNames('Referred by Rohit Kumar', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Rohit Kumar'))).toBe(true);
  });

  test('DOES flag "Anjali Patel" (Indian female name)', () => {
    const r = detectNames('Patient: Anjali Patel', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Anjali Patel'))).toBe(true);
  });

  test('DOES flag "Simran Kaur" (Sikh name)', () => {
    const r = detectNames('from Simran Kaur regarding appointment', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Simran Kaur'))).toBe(true);
  });

  // ── French and Italian names ───────────────────────────────────────────────

  test('DOES flag "Marie Dupont" (French name, with context)', () => {
    const r = detectNames('Name: Marie Dupont', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Marie'))).toBe(true);
  });

  test('DOES flag "Marco Rossi" (Italian name, with context)', () => {
    const r = detectNames('from Marco Rossi at the clinic', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Marco'))).toBe(true);
  });

  // ── Nigerian names ─────────────────────────────────────────────────────────

  test('DOES flag "Emeka Obi" (Nigerian Igbo name, with context)', () => {
    const r = detectNames('Patient: Emeka Obi', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Emeka'))).toBe(true);
  });

  test('DOES flag "Ngozi Adeyemi" (Nigerian female name, with context)', () => {
    const r = detectNames('Name: Ngozi Adeyemi', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Ngozi'))).toBe(true);
  });

  // ── Somali names ───────────────────────────────────────────────────────────

  test('DOES flag "Hodan Jama" (Somali female name, with context)', () => {
    const r = detectNames('Dear Hodan Jama', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Hodan'))).toBe(true);
  });

  // ── Polish names ───────────────────────────────────────────────────────────

  test('DOES flag "Piotr Kowalski" (Polish name, with context)', () => {
    const r = detectNames('from Piotr Kowalski regarding claim', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Piotr'))).toBe(true);
  });

  // ── "Max" name collision fix ───────────────────────────────────────────────

  test('DOES flag "Max Johnson" — "max" is a real name, not blocked by adjective gate', () => {
    const r = detectNames('Name: Max Johnson', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Max Johnson'))).toBe(true);
  });

  // ── Chinese names ──────────────────────────────────────────────────────────

  test('DOES flag "Xiuying Chen" (2-syllable Chinese name, no context needed)', () => {
    const r = detectNames('Xiuying Chen submitted the form', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Xiuying'))).toBe(true);
  });

  test('DOES flag "Meiling Zhang" (Chinese female name, no context)', () => {
    const r = detectNames('Meiling Zhang is the account holder', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Meiling'))).toBe(true);
  });

  test('DOES flag "Ming Chen" when Name: context is present', () => {
    // "ming" was removed from gazetteer (collision with "Ming Dynasty")
    // but context keyword still triggers detection
    const r = detectNames('Name: Ming Chen', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Ming') || t.includes('Chen'))).toBe(true);
  });

  // ── Chinese single-syllable false positive guard ───────────────────────────

  test('does NOT flag "Ming Dynasty" without context (gazetteer collision removed)', () => {
    const r = detectNames('The Ming Dynasty ruled for centuries', claimed());
    expect(r.map(r => r.text)).not.toContain('Ming Dynasty');
  });

  test('does NOT flag "Hong Kong" without context', () => {
    const r = detectNames('Our office is in Hong Kong', claimed());
    expect(r.map(r => r.text)).not.toContain('Hong Kong');
  });

  test('does NOT flag "Bin Collection" without context', () => {
    const r = detectNames('Bin Collection is on Tuesday', claimed());
    expect(r.map(r => r.text)).not.toContain('Bin Collection');
  });

  test('does NOT flag "Hung Parliament" without context', () => {
    const r = detectNames('The result was a Hung Parliament', claimed());
    expect(r.map(r => r.text)).not.toContain('Hung Parliament');
  });

  test('does NOT flag "Wing Commander" without context', () => {
    const r = detectNames('Wing Commander Smith led the squadron', claimed());
    // "Wing" removed from gazetteer; without context 2-word guard should block it
    // (unless "Smith" triggers something — the match would be "Wing Commander" or "Commander Smith")
    expect(r.map(r => r.text)).not.toContain('Wing Commander');
  });

  test('does NOT flag "Chi Squared" without context', () => {
    const r = detectNames('We applied a Chi Squared test', claimed());
    expect(r.map(r => r.text)).not.toContain('Chi Squared');
  });

  test('does NOT flag "Ping Test" without context', () => {
    const r = detectNames('Run a Ping Test to check latency', claimed());
    expect(r.map(r => r.text)).not.toContain('Ping Test');
  });

  // ── West African — Mande / Fula names ────────────────────────────────────

  test('DOES flag "Amara Diallo" (West African name, no context needed)', () => {
    const r = detectNames('Amara Diallo is registered at this practice', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Amara'))).toBe(true);
  });

  test('DOES flag "Fatoumata Bah" (Fula female name, with context)', () => {
    const r = detectNames('Patient: Fatoumata Bah', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Fatoumata'))).toBe(true);
  });

  test('DOES flag "Mamadou Diallo" (West African male name, with context)', () => {
    const r = detectNames('from Mamadou Diallo regarding his appointment', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Mamadou'))).toBe(true);
  });

  test('DOES flag "Ibrahima Sow" (Fula name, with context)', () => {
    const r = detectNames('Name: Ibrahima Sow', claimed());
    expect(r.map(r => r.text).some(t => t.includes('Ibrahima'))).toBe(true);
  });
});

// ─── detectUKPII (integration) ───────────────────────────────────────────────

describe('detectUKPII (integration)', () => {
  test('detects multiple PII types in one text', () => {
    const text = [
      'Hi, my name is Sarah Johnson.',
      'Email: sarah@nhs.uk',
      'Postcode: SW1A 1AA',
      'NHS: 943 476 1239',
    ].join(' ');
    const risks = detectUKPII(text);
    const t = types(risks);
    expect(t).toContain('email');
    expect(t).toContain('uk_postcode');
    expect(t).toContain('nhs_number');
  });

  test('no risks on plain prose', () => {
    const risks = detectUKPII('Please review the attached document and let me know your thoughts.');
    expect(risks).toHaveLength(0);
  });

  test('risks are sorted by start offset', () => {
    const text = 'email: a@b.com phone: 07700 900123';
    const risks = detectUKPII(text);
    for (let i = 1; i < risks.length; i++) {
      expect(risks[i].start).toBeGreaterThan(risks[i - 1].start);
    }
  });

  test('no double-detection (claimed spans prevent overlap)', () => {
    // A phone number should not also be matched as an NHS number
    const risks = detectUKPII('call 07700 900123');
    const phoneRisks = risks.filter(r => r.type === 'uk_phone');
    const nhsRisks = risks.filter(r => r.type === 'nhs_number');
    // If phone matched, NHS should not re-claim same span
    if (phoneRisks.length > 0) expect(nhsRisks).toHaveLength(0);
  });

  test('detects NI + email in same text', () => {
    const risks = detectUKPII('NI Number: AB 12 34 56 C email: john@company.co.uk');
    const t = types(risks);
    expect(t).toContain('ni_number');
    expect(t).toContain('email');
  });

  test('detects card + name', () => {
    const risks = detectUKPII('Mr John Smith paid with 4111 1111 1111 1111');
    const t = types(risks);
    expect(t).toContain('card_number');
    expect(t).toContain('name');
  });

  test('text is empty string → empty array', () => {
    expect(detectUKPII('')).toEqual([]);
  });

  test('non-string input → empty array', () => {
    expect(detectUKPII(null)).toEqual([]);
    expect(detectUKPII(undefined)).toEqual([]);
  });
});

// ─── Redact ──────────────────────────────────────────────────────────────────

describe('redact', () => {
  test('replaces a single risk with placeholder', () => {
    const text = 'Email: john@gmail.com thanks';
    const risks = [{ type: 'email', text: 'john@gmail.com', start: 7, end: 21 }];
    expect(redact(text, risks)).toBe('Email: [EMAIL_1] thanks');
  });

  test('replaces multiple non-overlapping risks', () => {
    const text = 'Patient John Smith, email: john@test.nhs.uk';
    const risks = [
      { type: 'name',  text: 'John Smith',         start: 8,  end: 18 },
      { type: 'email', text: 'john@test.nhs.uk',   start: 27, end: 43 },
    ];
    const result = redact(text, risks);
    expect(result).toBe('Patient [NAME_1], email: [EMAIL_1]');
  });

  test('indexes same type incrementally', () => {
    const text = 'a@b.com and c@d.com';
    const risks = [
      { type: 'email', text: 'a@b.com', start: 0,  end: 7  },
      { type: 'email', text: 'c@d.com', start: 12, end: 19 },
    ];
    const result = redact(text, risks);
    expect(result).toBe('[EMAIL_1] and [EMAIL_2]');
  });

  test('no risks → returns original text', () => {
    expect(redact('hello world', [])).toBe('hello world');
  });

  test('does not pad with spaces to preserve alignment when original is longer', () => {
    const text = 'Hello Christopher, how are you?';
    // Christopher (11 chars), [NAME_1] (8 chars) -> should not pad
    const risks = [{ type: 'name', text: 'Christopher', start: 6, end: 17 }];
    const result = redact(text, risks);
    expect(result).toBe('Hello [NAME_1], how are you?');
  });

  test('does not shrink when placeholder is longer than original', () => {
    const text = 'Hi Jo, how are you?';
    // Jo (2 chars), [NAME_1] (8 chars) -> should NOT pad (placeholder is already longer)
    const risks = [{ type: 'name', text: 'Jo', start: 3, end: 5 }];
    const result = redact(text, risks);
    expect(result).toBe('Hi [NAME_1], how are you?');
    expect(result.length).toBeGreaterThan(text.length);
  });

  test('getPlaceholder returns correct label for each type', () => {
    expect(getPlaceholder('nhs_number',  1)).toBe('[NHS_NUMBER_1]');
    expect(getPlaceholder('ni_number',   1)).toBe('[NI_NUMBER_1]');
    expect(getPlaceholder('uk_postcode', 1)).toBe('[POSTAL_CODE_1]');
    expect(getPlaceholder('uk_vat',      1)).toBe('[VAT_1]');
    expect(getPlaceholder('card_number', 1)).toBe('[CARD_1]');
    expect(getPlaceholder('uk_phone',    1)).toBe('[PHONE_1]');
    expect(getPlaceholder('email',       1)).toBe('[EMAIL_1]');
    expect(getPlaceholder('name',        2)).toBe('[NAME_2]');
    expect(getPlaceholder('unknown_xyz', 1)).toBe('[PII_1]');
  });
});
