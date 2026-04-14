import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * UK Physical Address Detector.
 * 
 * Finds patterns like:
 * - 123 High Street
 * - Apartment 4B, 123 Wellington Road
 * - London, SE1 7EH (as part of a larger address)
 */

const STREET_SUFFIXES = /\b(road|rd|street|st|avenue|ave|lane|ln|drive|dr|way|court|ct|square|sq|crescent|cres|close|cl|grove|gv|gardens|gdn|villas|mews|place|pl|terrace|terr|hill|rise|view|park|walk)\b/i;

// Logic: [Number] [Name] [StreetSuffix] ([City])
const RE_ADDRESS = /(?:(?:flat|apt|apartment|suite|unit)\s+\d+[a-z]?[\s,]+)?\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:road|rd|street|st|avenue|ave|lane|ln|drive|dr|way|court|ct|square|sq|crescent|cres|close|cl|grove|gv|gardens|gdn|villas|mews|place|pl|terrace|terr|hill|rise|view|park|walk)\b/gi;

const COMMON_CITIES = /\b(london|manchester|birmingham|leeds|glasgow|liverpool|newcastle|sheffield|bristol|cardiff|edinburgh|belfast|oxford|cambridge)\b/i;

export function detectAddress(text, claimed) {
  const risks = [];
  let match;
  RE_ADDRESS.lastIndex = 0;

  while ((match = RE_ADDRESS.exec(text)) !== null) {
    let start = match.index;
    let end = start + match[0].length;

    // Check if a city follows the street address (e.g., "123 High St, London")
    const after = text.slice(end, end + 30);
    const cityMatch = after.match(/^[\s,]+([A-Z][a-z]+)\b/i);
    if (cityMatch && COMMON_CITIES.test(cityMatch[1])) {
      end += cityMatch[0].length;
    }

    if (isOverlapping(claimed, start, end)) continue;

    risks.push(makeRisk('address', text.slice(start, end), start, end, 0.82));
    claimSpan(claimed, start, end);
  }

  return risks;
}
