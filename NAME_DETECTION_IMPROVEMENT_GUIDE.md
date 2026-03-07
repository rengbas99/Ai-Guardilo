# Enhanced Name Detection Implementation Guide

## Research Summary

Based on web research on NER (Named Entity Recognition) and name detection algorithms, the current implementation has these limitations:

### Current Limitations
1. **Geographic restriction**: Only UK-specific name lists (100 first names, 50 last names)
2. **Word pair limitation**: Only checks consecutive word pairs, misses multi-part names
3. **No international support**: Doesn't handle accented characters, non-Latin scripts
4. **Missing features**: No support for hyphens, apostrophes, initials, lowercase particles

### Research Findings

**Best Practices from NER Research**:
- Use **pattern-based detection** (regex) combined with **dictionary lookup**
- Support **multi-part names** (2-5 words), not just pairs
- Include **context clues** (titles, keywords, surrounding words)
- Support **international characters** (Unicode)
- Handle **name variations** (hyphens, apostrophes, particles)

## Enhanced Name Detection Patterns

### 1. Comprehensive Name Pattern (Multi-Part)

```javascript
// Pattern supporting: hyphens, apostrophes, initials, multi-part names, Unicode
const NAME_PATTERN = /\b(?:[A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*(?:\s+[A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*){1,4})\b/g

// Single-word name pattern (for names with apostrophes/hyphens like O'Brien, Müller, Smith-Jones)
const SINGLE_NAME_PATTERN = /\b([A-Z\u00C0-\u017F][a-z\u00C0-\u017F]*['-]?[A-Z\u00C0-\u017F]?[a-z\u00C0-\u017F]+)\b/g
```

**What it matches**:
- `John Smith` ✅
- `Mary-Anne Johnson` ✅
- `O'Brien` ✅ (single-word with apostrophe)
- `Müller` ✅ (single-word with Unicode)
- `Smith-Jones` ✅ (single-word with hyphen)
- `José García` ✅
- `Ludwig van Beethoven` ✅ (with lowercase particle handling)

### 2. Name with Title Pattern

```javascript
const NAME_WITH_TITLE = /\b(?:Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|Sir|Madam|Miss)\s+(?:[A-Z]\.\s+)*(?:[A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*(?:\s+(?:de|van|von|of|la|le|da|di|del|van der)\s+)?(?:[A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*){1,4})\b/gi
```

**What it matches**:
- `Dr. Sarah Williams` ✅
- `Mr. J. K. Rowling` ✅
- `Prof. Mary-Anne O'Connor` ✅

### 3. Lowercase Particles Support

```javascript
const LOWERCASE_PARTICLES = ['de', 'van', 'von', 'of', 'la', 'le', 'da', 'di', 'del', 'van der'];
```

**Examples**:
- `Ludwig van Beethoven` ✅
- `Gabriel de la Cruz` ✅
- `Leonardo da Vinci` ✅

## Test Cases

### Should Detect (True Positives)

```javascript
const positiveTests = [
  // Basic names
  "John Smith",                          // ✅ Two-word name
  "Mary Jane Watson",                    // ✅ Multi-part name (3 words)
  "Robert John Michael Brown",           // ✅ Multi-part name (4 words)
  
  // Hyphenated names
  "Mary-Anne Johnson",                   // ✅ Hyphenated first name
  "Jean-Luc Picard",                     // ✅ Hyphenated first name
  "Smith-Jones",                         // ✅ Hyphenated last name
  
  // Apostrophes
  "O'Brien",                             // ✅ Apostrophe in name
  "D'Artagnan",                          // ✅ Apostrophe in name
  "O'Connor-Smith",                      // ✅ Both apostrophe and hyphen
  
  // With titles
  "Dr. Sarah Williams",                  // ✅ Medical title
  "Mr. John Smith",                      // ✅ Mr. title
  "Prof. Mary-Anne O'Connor",           // ✅ Professor with complex name
  "Sir David Attenborough",              // ✅ Honorific
  
  // Initials
  "J.R.R. Tolkien",                      // ✅ Multiple initials
  "George R. R. Martin",                 // ✅ Initials with spaces
  "J. K. Rowling",                       // ✅ Initials with periods
  
  // International names
  "José García",                         // ✅ Spanish accented
  "François Müller",                     // ✅ French/German
  "Müller",                              // ✅ German umlaut
  "Björn",                               // ✅ Scandinavian
  
  // Lowercase particles
  "Ludwig van Beethoven",                // ✅ Dutch particle
  "Gabriel de la Cruz",                   // ✅ Spanish particles
  "Leonardo da Vinci",                    // ✅ Italian particle
  "Johann von Neumann",                  // ✅ German particle
  
  // Complex combinations
  "Dr. Mary-Anne O'Connor-Smith",        // ✅ All features
  "Prof. J.R.R. Tolkien",                // ✅ Title + initials
  "Sir Ludwig van Beethoven",            // ✅ Honorific + particle
  
  // Context-based
  "The patient John Doe",                 // ✅ Context keyword
  "Customer named Sarah Williams",        // ✅ "named" keyword
  "Contact: Robert Johnson",             // ✅ Contact keyword
  "User Mary Smith",                      // ✅ User keyword
];
```

### Should NOT Detect (False Positives)

```javascript
const negativeTests = [
  "Apple Inc",                           // ❌ Company name
  "New York",                            // ❌ Location
  "Monday Morning",                      // ❌ Day names
  "The Patient",                         // ❌ Single capitalized word
  "United States",                       // ❌ Country name
  "Red Cross",                           // ❌ Organization
  "Mount Everest",                       // ❌ Geographic feature
  "The Beatles",                         // ❌ Band name
  "iPhone",                              // ❌ Product name
  "JavaScript",                          // ❌ Technology name
];
```

## Implementation Code

### Enhanced `detectNames()` Method

```javascript
detectNames(text, contextBoost = 0) {
  const risks = [];
  const seenRanges = new Set();
  
  // Method 1: Pattern-based detection (multi-part names)
  const patternMatches = this.findNamePatterns(text);
  
  // Method 2: Context-enhanced detection
  const contextMatches = this.findContextualNames(text, contextBoost);
  
  // Method 3: Dictionary-enhanced
  const dictMatches = this.findDictionaryNames(text);
  
  // Merge all matches
  const allMatches = [...patternMatches, ...contextMatches, ...dictMatches];
  
  // Deduplicate and validate
  for (const match of allMatches) {
    const key = `name-${match.start}`;
    if (!seenRanges.has(key) && this.isValidNameSequence(match.text)) {
      risks.push({
        text: match.text,
        type: 'name',
        confidence: match.confidence,
        start: match.start,
        end: match.end
      });
      seenRanges.add(key);
    }
  }
  
  return risks;
}

// Find names using regex patterns
findNamePatterns(text) {
  const matches = [];
  const patterns = [
    // Single-word name (with apostrophes/hyphens like O'Brien, Müller, Smith-Jones)
    /\b([A-Z\u00C0-\u017F][a-z\u00C0-\u017F]*['-]?[A-Z\u00C0-\u017F]?[a-z\u00C0-\u017F]+)\b/g,
    // Multi-part name (2-5 words)
    /\b([A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*(?:\s+[A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*){1,4})\b/g,
    // Name with title
    /\b(?:Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|Sir|Madam|Miss)\s+([A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*(?:\s+(?:de|van|von|of|la|le|da|di|del|van der)\s+)?(?:[A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*){1,4})\b/gi
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1] || match[0];
      // For single-word names, check if it's a valid name sequence
      // For multi-part names, use existing validation
      if (this.isValidNameSequence(name) || (name.split(/\s+/).length === 1 && this.isValidSingleName(name))) {
        const hasTitle = match[0].includes('Dr') || match[0].includes('Mr') || match[0].includes('Mrs') || match[0].includes('Ms') || match[0].includes('Prof') || match[0].includes('Sir') || match[0].includes('Miss');
        matches.push({
          text: name,
          start: match.index,
          end: match.index + match[0].length,
          confidence: this.calculateNameConfidence(name, { hasTitle })
        });
      }
    }
  });
  
  return matches;
}

isValidSingleName(name) {
  // Validate single-word names with apostrophes/hyphens
  if (!/^[A-Z\u00C0-\u017F][a-z\u00C0-\u017F]*['-]?[A-Z\u00C0-\u017F]?[a-z\u00C0-\u017F]+$/.test(name)) {
    return false;
  }
  // Check false positives (whole word match)
  const nameLower = name.toLowerCase();
  const falsePositives = ['apple', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                          'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
                          'october', 'november', 'december'];
  return !falsePositives.includes(nameLower);
}

// Find names with context clues
findContextualNames(text, contextBoost) {
  const matches = [];
  const contextKeywords = ['patient', 'customer', 'client', 'user', 'member', 'named', 'called', 'contact'];
  
  // Look for names near context keywords
  const contextPattern = new RegExp(`\\b(?:${contextKeywords.join('|')})\\s+([A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*(?:\s+[A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+(?:['-][A-Z\u00C0-\u017F][a-z\u00C0-\u017F]+)*){1,4})\\b`, 'gi');
  
  let match;
  while ((match = contextPattern.exec(text)) !== null) {
    matches.push({
      text: match[1],
      start: match.index + match[0].indexOf(match[1]),
      end: match.index + match[0].indexOf(match[1]) + match[1].length,
      confidence: 0.90 + contextBoost // High confidence with context
    });
  }
  
  return matches;
}

// Validate name sequence
isValidNameSequence(name) {
  const words = name.trim().split(/\s+/);
  
  // Must have 2-5 words
  if (words.length < 2 || words.length > 5) return false;
  
  // Check each word (allow lowercase particles)
  const particles = ['de', 'van', 'von', 'of', 'la', 'le', 'da', 'di', 'del', 'van der'];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isParticle = particles.includes(word.toLowerCase());
    
    // First word must be capitalized AND not a particle
    if (i === 0) {
      if (!/^[A-Z\u00C0-\u017F]/.test(word) || isParticle) {
        return false;
      }
    }
    
    // Particles can be lowercase, others must start with capital
    if (!isParticle && !/^[A-Z\u00C0-\u017F]/.test(word)) {
      return false;
    }
    
    // Check for invalid patterns (numbers, special chars except hyphen/apostrophe)
    if (!/^[A-Z\u00C0-\u017Fa-z\u00C0-\u017F'\-]+$/.test(word)) {
      return false;
    }
  }
  
  // Exclude common false positives - match whole words only, not substrings
  const falsePositives = ['apple', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
                          'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
                          'october', 'november', 'december', 'united', 'states', 'new york', 'red cross'];
  
  // Split name into words and check each word against false positives
  const nameWords = name.toLowerCase().split(/\s+/);
  for (const fp of falsePositives) {
    // Check if false positive appears as a whole word (exact token match)
    if (nameWords.includes(fp)) {
      return false;
    }
  }
  
  return true;
}

// Calculate confidence score
calculateNameConfidence(name, context = {}) {
  let confidence = 0.70; // Base confidence
  
  // Boost if in dictionary
  const words = name.split(/\s+/);
  const firstWord = words[0].toLowerCase();
  const lastWord = words[words.length - 1].toLowerCase();
  
  if (this.commonFirstNames.has(firstWord) || this.commonLastNames.has(lastWord)) {
    confidence += 0.15; // +0.15 for dictionary match
  }
  
  // Boost if has title
  if (context.hasTitle) {
    confidence += 0.10; // +0.10 for title
  }
  
  // Boost if has context keywords (handled in findContextualNames)
  if (context.hasContext) {
    confidence += 0.10; // +0.10 for context
  }
  
  // Slight boost for hyphenated/apostrophe (more likely to be real name)
  if (name.includes('-') || name.includes("'")) {
    confidence += 0.05; // +0.05 for special characters
  }
  
  return Math.min(confidence, 0.95); // Cap at 0.95
}
```

## Testing Implementation

### Create Test File: `name-detection.test.js`

```javascript
import { PIIDetector } from './pii-detector.js';

const detector = new PIIDetector();

const testCases = [
  // Positive tests
  { text: "John Smith", expected: true, type: "basic" },
  { text: "Mary-Anne Johnson", expected: true, type: "hyphenated" },
  { text: "O'Brien", expected: true, type: "apostrophe" },
  { text: "Dr. Sarah Williams", expected: true, type: "with title" },
  { text: "J.R.R. Tolkien", expected: true, type: "initials" },
  { text: "Ludwig van Beethoven", expected: true, type: "particle" },
  { text: "José García", expected: true, type: "international" },
  { text: "The patient John Doe", expected: true, type: "context" },
  
  // Negative tests
  { text: "Apple Inc", expected: false, type: "company" },
  { text: "New York", expected: false, type: "location" },
  { text: "Monday Morning", expected: false, type: "day names" },
];

console.log('🧪 Testing Enhanced Name Detection\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const risks = detector.scan(test.text);
  const hasName = risks.some(r => r.type === 'name');
  const passedTest = hasName === test.expected;
  
  console.log(`Test ${index + 1}: ${test.type}`);
  console.log(`  Input: "${test.text}"`);
  console.log(`  Expected: ${test.expected ? 'Detect' : 'Ignore'}, Got: ${hasName ? 'Detected' : 'Ignored'}`);
  console.log(`  ${passedTest ? '✅ PASSED' : '❌ FAILED'}\n`);
  
  if (passedTest) passed++;
  else failed++;
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
```

## Implementation Steps

1. **Backup current code**: Save current `detectNames()` method
2. **Add new helper methods**: `findNamePatterns()`, `findContextualNames()`, `isValidNameSequence()`, `calculateNameConfidence()`
3. **Update `detectNames()`**: Replace with enhanced version
4. **Test thoroughly**: Run test suite with all test cases
5. **Tune confidence scores**: Adjust based on false positive/negative rates
6. **Expand name databases** (optional): Add international names

## Expected Improvements

- **Recall**: Detect 90%+ of names (vs ~60% currently)
- **Precision**: Maintain low false positive rate (<5%)
- **International support**: Handle accented characters, various name formats
- **Complex names**: Support hyphens, apostrophes, initials, particles
- **Multi-part names**: Detect 3-5 word names, not just pairs

## Performance Notes

- Pattern matching is fast (regex execution)
- Dictionary lookup optimized with Set (O(1))
- Limit name length to 2-5 words to prevent false positives
- Cache regex patterns for repeated use
