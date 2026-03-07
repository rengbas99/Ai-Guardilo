/**
 * Scan state: paste target, overlay target, scan ID generation, staleness
 */

let pasteTargetElement = null;
let overlayTargetElement = null;

const scans = new Map(); // scanId → { text, element, createdAt }

/** Normalize for comparison: trim and collapse whitespace */
function normalizeText(s) {
  if (typeof s !== 'string') return '';
  return s.trim().replace(/\s+/g, ' ');
}

/** Consider scan fresh (don't treat as stale) for this many ms so underlines always draw once */
const FRESH_SCAN_MS = 600;

export function createScan(text, element) {
  const id = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  scans.set(id, { text, element, createdAt: Date.now() });
  return id;
}

export function isScanStale(scanId) {
  const snap = scans.get(scanId);
  if (!snap) return true;
  // If scan was just created, never treat as stale so underlines always draw (paste/DOM can lag)
  if (Date.now() - (snap.createdAt || 0) < FRESH_SCAN_MS) return false;
  const current = snap.element?.value ?? snap.element?.innerText ?? snap.element?.textContent ?? '';
  const a = normalizeText(snap.text);
  const b = normalizeText(current);
  if (a === b) return false;
  // Also not stale if current content contains the scan text (e.g. contenteditable added wrapper nodes)
  if (b.length > 0 && a.length > 0 && b.includes(a)) return false;
  return true;
}

export function clearScan(scanId) {
  scans.delete(scanId);
}

export function clearAllScans() {
  scans.clear();
}

/** @deprecated Use createScan() for new scans; kept for compatibility */
export function generateScanId() {
  return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getPasteTargetElement() {
  return pasteTargetElement;
}

export function setPasteTargetElement(el) {
  pasteTargetElement = el;
}

export function clearPasteTargetElement() {
  pasteTargetElement = null;
}

export function getOverlayTargetElement() {
  return overlayTargetElement;
}

export function setOverlayTargetElement(el) {
  overlayTargetElement = el;
}

export function clearOverlayTargetElement() {
  overlayTargetElement = null;
}
