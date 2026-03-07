/**
 * rangeMapping.js
 * Single-pass text extraction + offset-to-range mapping.
 * Index uses NORMALIZED offsets so they match detection (which uses normalizeNewlines).
 */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA']);

/** Build normalized-offset → raw-offset map (handles \r\n → \n) */
function buildNormToRawMap(rawText) {
  const map = [0];
  let n = 0;
  for (let r = 0; r < rawText.length; r++) {
    if (rawText[r] === '\n' && rawText[r - 1] === '\r') continue; // already consumed as \r\n
    if (rawText[r] === '\r' && rawText[r + 1] === '\n') {
      n++;
      map[n] = r + 2;
      r++;
    } else if (rawText[r] === '\r' || rawText[r] === '\n') {
      n++;
      map[n] = r + 1;
    } else {
      n++;
      map[n] = r + 1;
    }
  }
  return map;
}

/**
 * Walk all text nodes under root, build normalized text and index.
 * Index offsets are in NORMALIZED text (matches fullText from getContentEditableText).
 *
 * @param {HTMLElement} root
 * @returns {{ text: string, index: Array<{node: Text, start: number, end: number, rawMap?: number[]}> }}
 */
export function buildTextIndex(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (SKIP_TAGS.has(node.parentElement?.tagName)) return NodeFilter.FILTER_REJECT;
      if (node.textContent.length === 0) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const index = [];
  let offset = 0;
  let node;

  while ((node = walker.nextNode())) {
    const raw = node.textContent;
    const norm = normalizeNewlines(raw);
    const len = norm.length;
    const rawMap = raw !== norm ? buildNormToRawMap(raw) : null;
    index.push({ node, start: offset, end: offset + len, rawMap });
    offset += len;
  }

  const text = index.map((e) => normalizeNewlines(e.node.textContent)).join('');
  return { text, index };
}

/**
 * Convert a [matchStart, matchEnd) offset pair (in NORMALIZED text) into a DOM Range.
 *
 * @param {Array<{node: Text, start: number, end: number, rawMap?: number[]}>} index
 * @param {number} matchStart
 * @param {number} matchEnd
 * @returns {Range|null}
 */
export function matchToRange(index, matchStart, matchEnd) {
  const range = document.createRange();
  let startSet = false;

  for (const entry of index) {
    // Start: find the node containing matchStart (entry.end > matchStart handles boundary)
    if (!startSet && entry.end > matchStart) {
      const localStart = matchStart - entry.start;
      const rawStart = entry.rawMap ? entry.rawMap[localStart] ?? entry.rawMap[0] : localStart;
      range.setStart(entry.node, Math.min(rawStart, entry.node.textContent.length));
      startSet = true;
    }
    // End: find the node containing matchEnd (entry.end >= matchEnd handles boundary)
    if (startSet && entry.end >= matchEnd) {
      const localEnd = matchEnd - entry.start;
      const rawEnd = entry.rawMap ? (entry.rawMap[localEnd] ?? entry.rawMap[entry.rawMap.length - 1]) : localEnd;
      range.setEnd(entry.node, Math.min(rawEnd, entry.node.textContent.length));
      return range;
    }
  }

  return null;
}

/**
 * Convenience: extract canonical text from a contenteditable root.
 * Normalises line endings so detection and index always agree.
 *
 * @param {HTMLElement} root
 * @returns {{ text: string, index: Array }}
 */
export function getContentEditableText(root) {
  const { text, index } = buildTextIndex(root);
  return { text: normalizeNewlines(text), index };
}

export function normalizeNewlines(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Map risks (with offsets in fullText) to equivalent offsets in domText.
 * Used when DOM text differs from pasted text (e.g. ProseMirror block structure).
 * Finds each risk.text in domText in order; returns null if any cannot be found.
 *
 * @param {Array<{text: string, start: number, end: number, ...}>} risks
 * @param {string} domText
 * @returns {Array<{...}>|null} Risks with start/end adjusted for domText, or null
 */
export function mapRisksToDomText(risks, domText) {
  const sorted = [...risks].sort((a, b) => a.start - b.start);
  const mapped = [];
  let searchStart = 0;
  for (const risk of sorted) {
    const idx = domText.indexOf(risk.text, searchStart);
    if (idx === -1) return null;
    mapped.push({ ...risk, start: idx, end: idx + risk.text.length });
    searchStart = idx + risk.text.length;
  }
  return mapped;
}
