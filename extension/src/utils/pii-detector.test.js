/**
 * Simple test file for PIIDetector
 * Run with: node utils/pii-detector.test.js
 */

import { PIIDetector } from './pii-detector.js';

const detector = new PIIDetector();

// Test cases
const testCases = [
  {
    name: 'UK Postcode Detection',
    text: 'Patient John Doe SW1A 1AA',
    expectedTypes: ['postcode', 'name']
  },
  {
    name: 'NHS Number Detection',
    text: 'NHS number: 123 456 7890',
    expectedTypes: ['nhs_number']
  },
  {
    name: 'Email Detection',
    text: 'Contact: patient@example.com',
    expectedTypes: ['email']
  },
  {
    name: 'Multiple PII',
    text: 'Patient John Smith, SW1A 1AA, email: john@test.com, NHS: 234 567 8901',
    expectedTypes: ['name', 'postcode', 'email', 'nhs_number']
  },
  {
    name: 'Context Boost',
    text: 'The patient named Sarah Williams lives at M1 1AA',
    expectedTypes: ['name', 'postcode']
  }
];

console.log('🧪 Testing PIIDetector...\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Input: "${testCase.text}"`);
  
  const risks = detector.scan(testCase.text);
  const detectedTypes = risks.map(r => r.type);
  
  console.log(`Detected: ${risks.length} risk(s)`);
  risks.forEach(risk => {
    console.log(`  - ${risk.type}: "${risk.text}" (confidence: ${(risk.confidence * 100).toFixed(1)}%)`);
  });
  
  // Check if all expected types are detected
  const allExpectedFound = testCase.expectedTypes.every(type => 
    detectedTypes.includes(type)
  );
  
  if (allExpectedFound && risks.length >= testCase.expectedTypes.length) {
    console.log('✅ PASSED\n');
    passed++;
  } else {
    console.log(`❌ FAILED - Expected: ${testCase.expectedTypes.join(', ')}, Got: ${detectedTypes.join(', ')}\n`);
    failed++;
  }
});

// Test redaction
console.log('\n🧪 Testing Redaction...\n');
const testText = 'Patient John Smith, SW1A 1AA, email: john@test.com';
const risks = detector.scan(testText);
const redacted = detector.redact(testText, risks);
console.log(`Original: ${testText}`);
console.log(`Redacted: ${redacted}`);
console.log('✅ Redaction test complete\n');

// Test mock values
console.log('🧪 Testing Mock Values...\n');
['postcode', 'nhs_number', 'email', 'name'].forEach(type => {
  console.log(`${type}: ${detector.getMockValue(type, 1)}`);
});
console.log('✅ Mock values test complete\n');

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

