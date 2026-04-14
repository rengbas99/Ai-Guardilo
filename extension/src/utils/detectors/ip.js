import { claimSpan, isOverlapping, makeRisk } from './shared.js';

/**
 * IPv4 address detector.
 *
 * Matches properly-ranged octets (0-255) only — no false matches on
 * version strings like "1.2.3.4.5" or decimals like "3.14159".
 *
 * Confidence:
 *   - Public (routable) IP → 0.88 — directly identifies a device/user
 *   - Private/CGNAT range  → 0.75 — reveals network topology; lower FP risk
 *   - Loopback (127.x)     → skipped — not PII
 *   - Unspecified (0.0.0.0) / broadcast (255.255.255.255) → skipped
 */

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]\\d|\\d)';
const RE_IPv4 = new RegExp(`(?<![\\d.])${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}(?![\\d.])`, 'g');

function classifyIP(ip) {
  const [a, b] = ip.split('.').map(Number);
  // Loopback
  if (a === 127) return 'loopback';
  // Unspecified / broadcast
  if (ip === '0.0.0.0' || ip === '255.255.255.255') return 'reserved';
  // Private: 10.x, 172.16-31.x, 192.168.x, CGNAT 100.64-127.x, link-local 169.254.x
  if (a === 10) return 'private';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 100 && b >= 64 && b <= 127) return 'private';
  if (a === 169 && b === 254) return 'private';
  return 'public';
}

export function detectIP(text, claimed) {
  const risks = [];
  let match;
  RE_IPv4.lastIndex = 0;

  while ((match = RE_IPv4.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (isOverlapping(claimed, start, end)) continue;

    const cls = classifyIP(raw);
    if (cls === 'loopback' || cls === 'reserved') continue;

    const confidence = cls === 'public' ? 0.88 : 0.75;
    risks.push(makeRisk('ip_address', raw, start, end, confidence));
    claimSpan(claimed, start, end);
  }

  return risks;
}
