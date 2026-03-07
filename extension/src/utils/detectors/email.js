import { claimSpan, isOverlapping, makeRisk } from './shared.js';

// Match email; support compound TLDs like .co.uk; must be followed by non-letter so we stop at .uk/.com
const RE_EMAIL = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}(?:\.[a-zA-Z]{2,6})?(?=[^a-zA-Z]|$)/g;

export function detectEmail(text, claimed) {
  const risks = [];
  let match;
  RE_EMAIL.lastIndex = 0;

  while ((match = RE_EMAIL.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (isOverlapping(claimed, start, end)) continue;

    if (/^(user|name|email)@(example|test|domain)\.(com|org|net)$/i.test(match[0])) continue;

    risks.push(makeRisk('email', match[0], start, end, 0.97));
    claimSpan(claimed, start, end);
  }

  return risks;
}
