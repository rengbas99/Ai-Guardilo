/**
 * Zero-Leak PII Detection Service
 * Primary: window.ai (Chrome AI / Gemini Nano) - local, no data leaves device.
 * Fallback: Regex detection when local AI unavailable.
 * No cloud API; all processing is on-device.
 */

const SYSTEM_INSTRUCTION = `You are AI Guardrail. Analyze the provided text for GDPR-sensitive PII.

ENTITY TYPES: PERSON, PHONE, EMAIL, ADDRESS, UK_VAT, UK_SORTCODE, NHS_NUMBER, NI_NUMBER, POSTCODE.

PERSON (names) – Be strict. Only flag actual person names:
- Full names (e.g. "John Smith", "Maria García", "Wei Chen").
- First+last or title+name (e.g. "Dr. Sarah Jones", "Mr. David Lee").
Do NOT flag: pronouns (I, you, he, she, they, we, it), common words (why, okay, not, am, is, are, was, were), generic phrases ("she is", "am i", "not okay"), or single common words that are not clearly names. When in doubt, do not include as PERSON.

Other types (PHONE, EMAIL, etc.): flag only when the pattern clearly matches (e.g. valid email format, 10+ digit phone, valid postcode).

Return ONLY a JSON object with an "entities" array. Each entity: type, text, start, end, confidence (0–1). start/end must be exact character indices in the input. If no PII is found, return {"entities":[]}. No markdown, no code fences, no text outside the JSON.`;

const AI_TYPE_TO_INTERNAL = {
  PERSON: 'name',
  PHONE: 'phone',
  EMAIL: 'email',
  ADDRESS: 'address',
  UK_VAT: 'vat',
  UK_SORTCODE: 'sortcode',
  NHS_NUMBER: 'nhs_number',
  NI_NUMBER: 'ni_number',
  POSTCODE: 'postcode',
};

/**
 * Safely parses JSON from LLM output that may contain markdown fences or prose.
 * @param {string} raw - Raw string returned by the model
 * @returns {object} Parsed JSON
 * @throws {Error} If no JSON object can be extracted
 */
function parseLLMJson(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('LLM returned empty output');

  // Strip ```json ... ``` or ``` ... ``` fences (most common)
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1].trim());

  // Extract first { ... } block (handles preamble prose)
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) return JSON.parse(objMatch[0]);

  // Last resort: parse the whole string
  return JSON.parse(raw.trim());
}

/**
 * Validate parsed LLM response has .entities array.
 * @param {object} parsed
 * @returns {object}
 * @throws {Error} If shape invalid
 */
function validateEntityResponse(parsed) {
  if (!parsed || !Array.isArray(parsed.entities)) {
    throw new Error(`LLM response missing .entities array: ${JSON.stringify(parsed?.entities != null ? 'invalid shape' : parsed)}`);
  }
  return parsed;
}

/**
 * Parse AI response into { entities, source }. Handles parse errors; uses safe parse + validate.
 * @param {string} raw - Raw model output
 * @param {'local'|'cloud'} source
 * @returns {{ entities: Array, source: string }}
 */
function parseAiResponse(raw, source) {
  try {
    const parsed = validateEntityResponse(parseLLMJson(raw || ''));
    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    return { entities, source };
  } catch (e) {
    return { entities: [], source };
  }
}

/**
 * Map AI entity to internal risk shape: { text, type, confidence, start, end, risk }.
 * @param {Object} entity - { type, text, start, end, confidence }
 * @param {'local'|'cloud'} detectionSource
 * @returns {Object}
 */
function mapEntityToRisk(entity, detectionSource) {
  const internalType = AI_TYPE_TO_INTERNAL[entity.type] || entity.type?.toLowerCase() || 'pii';
  const confidence = typeof entity.confidence === 'number' ? entity.confidence : 0.9;
  const risk = confidence >= 0.85 ? 'HIGH' : 'MEDIUM';
  return {
    text: entity.text || '',
    type: internalType,
    confidence,
    start: typeof entity.start === 'number' ? entity.start : 0,
    end: typeof entity.end === 'number' ? entity.end : (entity.text || '').length,
    risk,
    detectionSource,
  };
}

/**
 * Try local detection via window.ai (Gemini Nano). Returns null if unavailable or error.
 * @param {string} text
 * @returns {Promise<{ entities: Array, source: 'local' }|null>}
 */
async function tryLocalDetection(text) {
  try {
    const ai = typeof window !== 'undefined' && window.ai;
    const lm = ai?.languageModel;
    if (!lm) return null;

    const caps = await lm.capabilities();
    if (caps?.available !== 'readily') return null;

    const session = await lm.createSession({ systemPrompt: SYSTEM_INSTRUCTION });
    if (!session) return null;

    const [response] = await session.prompt(text);
    const raw = response?.trim() || '';
    const { entities, source } = parseAiResponse(raw, 'local');
    return { entities, source };
  } catch (e) {
    return null;
  }
}

/**
 * Zero-Leak detection: Chrome AI (local) only. No cloud. On failure, throws so caller uses regex.
 * @param {string} text - Full input text to analyze
 * @returns {Promise<{ risks: Array<{text, type, confidence, start, end, risk, detectionSource?}>, source: 'local'|'fallback' }>}
 */
export async function detectPIIWithAI(text) {
  if (!text || typeof text !== 'string') {
    return { risks: [], source: 'fallback' };
  }

  try {
    const local = await tryLocalDetection(text);
    if (local?.entities?.length > 0) {
      const risks = local.entities
        .filter((e) => e.text && (e.start !== undefined) && (e.end !== undefined))
        .map((e) => mapEntityToRisk(e, local.source));
      return { risks, source: local.source };
    }
  } catch (localErr) {
  }

  // No cloud path; caller will use regex fallback
  throw new Error('Local AI unavailable');
}
