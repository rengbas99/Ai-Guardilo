/**
 * PIIDetector - Tier 1 Hybrid Cascade Detection Engine
 * Detects UK PII: postcodes (98%), NHS numbers (99%), emails (97%), names
 * 100% local execution, no server calls
 */

export class PIIDetector {
  constructor() {
    // UK Postcode Regex (98% accuracy target)
    // Format: AA9A 9AA, A9A 9AA, A9 9AA, A99 9AA, AA9 9AA, AA99 9AA
    this.postcodeRegex = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/gi;
    
    // NHS Number Regex (99% accuracy target)
    // Format: 10 digits, with validation checksum
    this.nhsNumberRegex = /\b(\d{3}\s?\d{3}\s?\d{4})\b/g;
    
    // Email Regex (97% accuracy target)
    this.emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
    
    // Name detection - common UK first/last names with context
    // Enhanced with context keywords
    this.nameKeywords = [
      'patient', 'customer', 'client', 'user', 'member',
      'name', 'named', 'called', 'known as', 'referred to'
    ];
    
    // Common UK first names (top 100)
    this.commonFirstNames = new Set([
      'james', 'mary', 'john', 'patricia', 'robert', 'jennifer',
      'michael', 'linda', 'william', 'elizabeth', 'david', 'barbara',
      'richard', 'susan', 'joseph', 'jessica', 'thomas', 'sarah',
      'charles', 'karen', 'christopher', 'nancy', 'daniel', 'lisa',
      'matthew', 'betty', 'anthony', 'margaret', 'mark', 'sandra',
      'donald', 'ashley', 'steven', 'kimberly', 'paul', 'emily',
      'andrew', 'donna', 'joshua', 'michelle', 'kenneth', 'dorothy',
      'kevin', 'carol', 'brian', 'amanda', 'george', 'melissa',
      'edward', 'deborah', 'ronald', 'stephanie', 'timothy', 'rebecca',
      'jason', 'sharon', 'jeffrey', 'laura', 'ryan', 'cynthia',
      'jacob', 'kathleen', 'gary', 'amy', 'nicholas', 'angela',
      'eric', 'shirley', 'jonathan', 'anna', 'stephen', 'brenda',
      'larry', 'pamela', 'justin', 'emma', 'scott', 'nicole',
      'brandon', 'virginia', 'benjamin', 'maria', 'samuel', 'helen',
      'frank', 'samantha', 'gregory', 'christine', 'raymond', 'debra',
      'alexander', 'rachel', 'patrick', 'carolyn', 'jack', 'janet',
      'dennis', 'catherine', 'jerry', 'maria', 'tyler', 'frances',
      'aaron', 'ann', 'jose', 'joyce', 'henry', 'diane'
    ]);
    
    // Common UK last names (top 50 + common test names)
    this.commonLastNames = new Set([
      'smith', 'jones', 'williams', 'brown', 'taylor', 'davies',
      'wilson', 'evans', 'thomas', 'johnson', 'roberts', 'walker',
      'wright', 'robinson', 'thompson', 'white', 'hughes', 'edwards',
      'green', 'hall', 'wood', 'harris', 'lewis', 'martin', 'clarke',
      'jackson', 'clark', 'turner', 'hill', 'scott', 'cooper', 'morris',
      'ward', 'moore', 'king', 'watson', 'baker', 'harrison', 'morgan',
      'patel', 'young', 'allen', 'mitchell', 'anderson', 'lee', 'phillips',
      'doe' // Common test name
    ]);
  }

  /**
   * Scans text for PII and returns structured results
   * @param {string} text - Input text to scan
   * @returns {Array<{text: string, type: string, confidence: number, start: number, end: number}>}
   */
  scan(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const risks = [];
    const seenRanges = new Set(); // Prevent duplicate detections

    // Context boost: check for PII-related keywords
    const hasContext = this.nameKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
    const contextBoost = hasContext ? 0.1 : 0;

    // 1. UK Postcode Detection (98% confidence)
    let match;
    while ((match = this.postcodeRegex.exec(text)) !== null) {
      const postcode = match[1].replace(/\s+/g, ' ').toUpperCase();
      const normalized = postcode.replace(/\s/g, '');
      
      // Validate postcode format more strictly
      if (this.isValidPostcode(normalized)) {
        const key = `postcode-${match.index}`;
        if (!seenRanges.has(key)) {
          risks.push({
            text: postcode,
            type: 'postcode',
            confidence: 0.98 + contextBoost,
            start: match.index,
            end: match.index + match[0].length
          });
          seenRanges.add(key);
        }
      }
    }

    // 2. NHS Number Detection (99% confidence)
    this.nhsNumberRegex.lastIndex = 0;
    while ((match = this.nhsNumberRegex.exec(text)) !== null) {
      const nhsNumber = match[1].replace(/\s/g, '');
      
      // Validate NHS number format (10 digits)
      // For detection, we prioritize format matching over strict checksum validation
      // This ensures we catch potential PII even if checksum is invalid (typos, test data, etc.)
      if (nhsNumber.length === 10 && /^\d{10}$/.test(nhsNumber)) {
        // Validate checksum for confidence boost
        const checksumValid = this.isValidNHSNumber(nhsNumber);
        
        // Accept format-valid NHS numbers
        // Higher confidence if checksum validates, lower if it doesn't (but still detect)
        const key = `nhs-${match.index}`;
        if (!seenRanges.has(key)) {
          risks.push({
            text: match[1],
            type: 'nhs_number',
            confidence: checksumValid ? 0.99 : 0.88, // High confidence even without checksum (format is strong indicator)
            start: match.index,
            end: match.index + match[0].length
          });
          seenRanges.add(key);
        }
      }
    }

    // 3. Email Detection (97% confidence)
    this.emailRegex.lastIndex = 0;
    while ((match = this.emailRegex.exec(text)) !== null) {
      const key = `email-${match.index}`;
      if (!seenRanges.has(key)) {
        risks.push({
          text: match[1],
          type: 'email',
          confidence: 0.97 + contextBoost,
          start: match.index,
          end: match.index + match[0].length
        });
        seenRanges.add(key);
      }
    }

    // 4. Name Detection (with context boost)
    const nameRisks = this.detectNames(text, contextBoost);
    nameRisks.forEach(risk => {
      const key = `name-${risk.start}`;
      if (!seenRanges.has(key)) {
        risks.push(risk);
        seenRanges.add(key);
      }
    });

    // Sort by position in text
    risks.sort((a, b) => a.start - b.start);

    // Remove overlapping detections (keep higher confidence)
    return this.deduplicateOverlaps(risks);
  }

  /**
   * Validates UK postcode format
   * @param {string} postcode - Postcode without spaces
   * @returns {boolean}
   */
  isValidPostcode(postcode) {
    // UK postcode patterns
    const patterns = [
      /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/,  // Standard format
    ];
    
    return patterns.some(pattern => pattern.test(postcode));
  }

  /**
   * Validates NHS number using checksum algorithm
   * @param {string} nhsNumber - 10 digit NHS number
   * @returns {boolean}
   */
  isValidNHSNumber(nhsNumber) {
    if (nhsNumber.length !== 10 || !/^\d+$/.test(nhsNumber)) {
      return false;
    }

    // NHS number checksum validation
    const digits = nhsNumber.split('').map(Number);
    let sum = 0;
    
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? remainder : 11 - remainder;
    
    return checkDigit === digits[9];
  }

  /**
   * Detects names using pattern matching and common name lists
   * @param {string} text - Input text
   * @param {number} contextBoost - Confidence boost from context
   * @returns {Array<{text: string, type: string, confidence: number, start: number, end: number}>}
   */
  detectNames(text, contextBoost = 0) {
    const risks = [];
    const words = text.split(/\s+/);
    
    // Improved name detection: check all consecutive word pairs
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i].replace(/[.,!?;:()\[\]{}'"]/g, '').toLowerCase();
      const word2 = words[i + 1].replace(/[.,!?;:()\[\]{}'"]/g, '').toLowerCase();
      
      // Check for "First Last" pattern
      const isFirstName = this.commonFirstNames.has(word1);
      const isLastName = this.commonLastNames.has(word2);
      
      // Also check capitalized words that look like names (Title Case)
      const originalWord1 = words[i].replace(/[.,!?;:()\[\]{}'"]/g, '');
      const originalWord2 = words[i + 1].replace(/[.,!?;:()\[\]{}'"]/g, '');
      const isTitleCase1 = /^[A-Z][a-z]+$/.test(originalWord1);
      const isTitleCase2 = /^[A-Z][a-z]+$/.test(originalWord2);
      
      // More lenient detection: if first name found, check if next word is capitalized (likely last name)
      // OR if both are title case and context suggests PII
      const likelyNamePair = (isFirstName && isTitleCase2) || 
                            (isFirstName && isLastName) ||
                            (isTitleCase1 && isTitleCase2 && (contextBoost > 0 || isLastName));
      
      if (likelyNamePair) {
        // Find original positions in text (handle multiple occurrences)
        // Use word boundaries to match exact words
        const escapedWord1 = this.escapeRegex(originalWord1);
        const escapedWord2 = this.escapeRegex(originalWord2);
        const pattern = new RegExp(`\\b${escapedWord1}\\s+${escapedWord2}\\b`, 'gi');
        
        // Find all matches to get correct positions
        let match;
        while ((match = pattern.exec(text)) !== null) {
          // Avoid duplicates
          const existing = risks.find(r => r.start === match.index);
          if (!existing) {
            risks.push({
              text: match[0],
              type: 'name',
              confidence: (isFirstName && isLastName) ? 0.85 + contextBoost : 
                         (isFirstName && isTitleCase2) ? 0.80 + contextBoost : 
                         0.70 + contextBoost,
              start: match.index,
              end: match.index + match[0].length
            });
          }
        }
      }
    }
    
    return risks;
  }

  /**
   * Escapes special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Removes overlapping detections, keeping higher confidence ones
   * @param {Array} risks - Array of risk objects
   * @returns {Array} Deduplicated risks
   */
  deduplicateOverlaps(risks) {
    const filtered = [];
    
    for (const risk of risks) {
      let overlaps = false;
      
      for (const existing of filtered) {
        // Check if ranges overlap
        if (!(risk.end <= existing.start || risk.start >= existing.end)) {
          overlaps = true;
          // Keep the one with higher confidence
          if (risk.confidence > existing.confidence) {
            const index = filtered.indexOf(existing);
            filtered[index] = risk;
          }
          break;
        }
      }
      
      if (!overlaps) {
        filtered.push(risk);
      }
    }
    
    return filtered;
  }

  /**
   * Redacts PII from text, replacing with placeholders
   * @param {string} text - Original text
   * @param {Array} risks - Array of risk objects from scan()
   * @returns {string} Redacted text
   */
  redact(text, risks) {
    if (!risks || risks.length === 0) {
      return text;
    }

    // Sort risks by position (reverse order for safe replacement)
    const sortedRisks = [...risks].sort((a, b) => b.start - a.start);
    
    let redacted = text;
    const counters = {
      postcode: 0,
      nhs_number: 0,
      email: 0,
      name: 0
    };

    for (const risk of sortedRisks) {
      counters[risk.type]++;
      const placeholder = this.getPlaceholder(risk.type, counters[risk.type]);
      
      // Replace the risk text with placeholder
      redacted = redacted.substring(0, risk.start) + 
                 placeholder + 
                 redacted.substring(risk.end);
    }

    return redacted;
  }

  /**
   * Gets placeholder text for a risk type
   * @param {string} type - Risk type (postcode, nhs_number, email, name)
   * @param {number} index - Index for numbering
   * @returns {string} Placeholder text
   */
  getPlaceholder(type, index) {
    const placeholders = {
      postcode: `[POSTCODE_${index}]`,
      nhs_number: `[NHS_NUMBER_${index}]`,
      email: `[EMAIL_${index}]`,
      name: `[NAME_${index}]`
    };
    
    return placeholders[type] || `[PII_${index}]`;
  }

  /**
   * Gets a mock value for a risk type (for double-click editing)
   * @param {string} type - Risk type
   * @param {number} index - Index for variation
   * @returns {string} Mock value
   */
  getMockValue(type, index) {
    const mocks = {
      postcode: [
        'SW1A 1AA', 'M1 1AA', 'B33 8TH', 'LS1 4DY', 'OX1 1DP'
      ],
      nhs_number: [
        '123 456 7890', '234 567 8901', '345 678 9012', '456 789 0123'
      ],
      email: [
        'example@domain.com', 'test@example.org', 'sample@test.co.uk', 'user@demo.net'
      ],
      name: [
        'John Smith', 'Jane Doe', 'Robert Johnson', 'Sarah Williams', 'Michael Brown'
      ]
    };
    
    const options = mocks[type] || ['[MOCK_VALUE]'];
    return options[(index - 1) % options.length];
  }
}

