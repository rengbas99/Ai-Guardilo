# PII Types Detected by AI Guardrail

## Currently Supported PII Types

The extension can detect the following types of Personally Identifiable Information (PII):

### 1. **UK Postcodes** (98% accuracy)
- **Format**: AA9A 9AA, A9A 9AA, A9 9AA, A99 9AA, AA9 9AA, AA99 9AA
- **Examples**:
  - `SW1A 1AA` (Westminster, London)
  - `M1 1AA` (Manchester)
  - `B33 8TH` (Birmingham)
  - `LS1 4DY` (Leeds)
  - `OX1 1DP` (Oxford)
- **Detection**: Regex pattern matching with format validation
- **Redaction**: Replaced with `[POSTCODE_1]`, `[POSTCODE_2]`, etc.

### 2. **NHS Numbers** (88-99% accuracy)
- **Format**: 10 digits, optionally spaced (123 456 7890 or 1234567890)
- **Examples**:
  - `123 456 7890`
  - `2345678901`
- **Detection**: Format validation (10 digits) + optional checksum validation
- **Redaction**: Replaced with `[NHS_NUMBER_1]`, `[NHS_NUMBER_2]`, etc.
- **Note**: Checksum validation increases confidence to 99%, format-only detection is 88%

### 3. **Email Addresses** (97% accuracy)
- **Format**: Standard email format (user@domain.com)
- **Examples**:
  - `john.doe@example.com`
  - `patient@nhs.uk`
  - `user+tag@domain.co.uk`
- **Detection**: Regex pattern matching
- **Redaction**: Replaced with `[EMAIL_1]`, `[EMAIL_2]`, etc.

### 4. **Names** (70-95% accuracy)
- **Format**: First name + Last name (Title Case)
- **Examples**:
  - `John Doe`
  - `Sarah Williams`
  - `Robert Johnson`
- **Detection**: 
  - Common UK first names database (100+ names)
  - Common UK last names database (50+ names)
  - Title Case pattern matching (capitalized words)
  - Context boost when keywords like "patient", "customer" are present
- **Redaction**: Replaced with `[NAME_1]`, `[NAME_2]`, etc.
- **Confidence Levels**:
  - 85%: First name in database + Last name in database
  - 80%: First name in database + Capitalized last name
  - 70%: Title Case pattern with context keywords

## Detection Accuracy Summary

| PII Type | Accuracy | Method |
|----------|----------|--------|
| UK Postcodes | 98% | Regex + Format Validation |
| NHS Numbers | 88-99% | Format + Checksum Validation |
| Email Addresses | 97% | Regex Pattern Matching |
| Names | 70-95% | Database + Pattern + Context |

## Context Boost

Detection confidence increases by 10% when PII-related keywords are present:
- `patient`
- `customer`
- `client`
- `user`
- `member`
- `name`, `named`, `called`, `known as`, `referred to`

## Future Enhancements (Not Currently Implemented)

The following are **NOT** currently detected but could be added:
- ❌ Phone numbers
- ❌ Credit card numbers
- ❌ Bank account numbers
- ❌ National Insurance numbers (NI)
- ❌ Passport numbers
- ❌ Driver's license numbers
- ❌ Date of birth patterns
- ❌ IP addresses
- ❌ MAC addresses

## Testing Examples

Use these test strings to verify detection:

```
# Single PII
Patient John Doe
SW1A 1AA
john@test.com
123 456 7890

# Multiple PII
Patient John Doe, SW1A 1AA, email: john@test.com, NHS: 123 456 7890

# Context boost
The patient named Sarah Williams lives at M1 1AA
```

## Redaction Format

All PII is replaced with numbered placeholders:
- `[NAME_1]`, `[NAME_2]`, etc.
- `[POSTCODE_1]`, `[POSTCODE_2]`, etc.
- `[EMAIL_1]`, `[EMAIL_2]`, etc.
- `[NHS_NUMBER_1]`, `[NHS_NUMBER_2]`, etc.

These placeholders are:
- **Double-click editable** (future feature)
- **Consistent** across the same type
- **Numbered** for tracking multiple instances

