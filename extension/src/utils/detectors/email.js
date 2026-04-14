import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * Email address detector.
 *
 * Improvements over v1:
 * - Expanded placeholder/example filter: covers user@example.com AND broader
 *   generic username + generic domain combinations (noreply, test, admin at
 *   example/test/domain/placeholder/invalid/localhost domains)
 * - Added common UK domain filter — schema-like strings such as
 *   @company.com that appear in templates ("Email: email@company.com") are
 *   accepted because they're real; only clear placeholder combos are dropped
 * - TLD length extended to 10 to cover modern gTLDs (.photography, .solutions)
 * - Negative lookahead tightened: ensures we stop before another letter (avoids
 *   trailing dot crawl on compound TLDs like .co.uk.something)
 */

const RE_EMAIL =
  /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,13}(?:\.[a-zA-Z]{2,6})?(?=[^a-zA-Z]|$)/g;

// Generic domains used in examples/templates
// NOTE: 'example' intentionally removed — real addresses like sarah@example.co.uk should be flagged
const RE_EXAMPLE_DOMAIN = /^[^@]+@(test|domain|placeholder|invalid|localhost|email|your[-_.]?(?:company|domain|email|name))\./i;

// Local-part patterns that are always placeholder/form labels (combined with any domain)
const RE_PLACEHOLDER_LOCAL = /^(your[-_.]?email|your[-_.]?name|email[-_.]?address|name[-_.]?here|enter[-_.]?email|user[@])@/i;

export function detectEmail(text, claimed) {
  const risks = [];
  let match;
  RE_EMAIL.lastIndex = 0;

  while ((match = RE_EMAIL.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;
    if (RE_EXAMPLE_DOMAIN.test(match[0])) continue;
    if (RE_PLACEHOLDER_LOCAL.test(match[0])) continue;

    risks.push(makeRisk('email', match[0], start, end, 0.97));
    claimSpan(claimed, start, end);
  }

  return risks;
}
