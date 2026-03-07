# AI Guardrail – Chrome Extension Review Document

**Purpose:** Detailed technical breakdown for Chrome Web Store review and AI-assisted review.  
**Version:** 1.0.0  
**Last updated:** March 2025

---

## 1. Executive Summary

**AI Guardrail** is a Chrome extension that detects personally identifiable information (PII) in text before users send messages in AI chat interfaces (ChatGPT, Claude, Perplexity, Gemini, Slack, etc.). It underlines detected PII, offers one-click redaction, and stores only metadata locally. **No user text is ever sent to external servers.**

| Aspect | Detail |
|--------|--------|
| **Detection** | Chrome AI (window.ai / Gemini Nano) when available; regex fallback otherwise. All on-device. |
| **Data sent externally** | None |
| **Data stored** | Risk logs (type + confidence only), aggregate stats, settings. All in `chrome.storage.local`. |
| **Permissions** | `activeTab`, `storage`, `clipboardWrite` |
| **Host permissions** | None (no external API calls) |

---

## 2. Store listing & privacy disclosure

### 2.1 Chrome Web Store declaration

In the Chrome Web Store dashboard, declare that the item **handles personal or sensitive user data**, and ensure the listing states in plain language:

- Text is **processed locally** for PII detection.
- **No raw prompt text or PII is ever transmitted or persisted.**
- Only **anonymized risk metadata** (risk categories, confidence, timestamps, aggregate counts) is stored locally.

### 2.2 Suggested store description text

**Short description (132 chars max):**  
Scans text in AI chat interfaces to detect and redact personal data before sending. 100% local; no data sent to servers.

**Detailed description (include):**  
This extension scans text entered into supported AI chat interfaces (e.g. ChatGPT, Claude, Perplexity, Gemini, Slack) to detect and redact personal data before sending. All detection runs on-device (Chrome AI when available, or local regex). No text is transmitted to external servers. Only anonymized metadata (risk type and confidence) is stored locally. clipboardWrite is used only when you click “Update” to copy redacted text to the clipboard.

### 2.3 Mapping internal terms to store wording

| Internal term | Store / policy wording |
|---------------|------------------------|
| riskLogs | We store scan metadata: risk categories and confidence scores, not the underlying messages. |
| stats | We store aggregate counts (total risks, high/medium, per-domain). |
| risk.text | Never stored; used only in memory for UI (underline, tooltip). |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTENT SCRIPT (injected on matched sites)          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ paste       │  │ input        │  │ file upload  │  │ scanAndAlert()  │  │
│  │ handler     │  │ handler      │  │ handler      │  │ (orchestrator)  │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                │                 │                    │           │
│         └────────────────┴─────────────────┴────────────────────┘           │
│                                          │                                   │
│         ┌────────────────────────────────┼────────────────────────────────┐ │
│         │                                ▼                                │ │
│         │  ┌─────────────────────────────────────────────────────────────┐ │ │
│         │  │ detectPIIWithAI() → tryLocalDetection (window.ai)           │ │ │
│         │  │              ↓ (if fails)                                  │ │ │
│         │  │ getFallbackRisks() → PIIDetector.scan() + regex patterns    │ │ │
│         │  └─────────────────────────────────────────────────────────────┘ │ │
│         │                                │                                 │ │
│         │                                ▼                                 │ │
│         │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │ │
│         │  │ showInline      │  │ showBodyPopup   │  │ logRisk()       │  │ │
│         │  │ Suggestions()   │  │ (pill)          │  │ sendStatsUpdate │  │ │
│         │  │ (highlights +   │  │                 │  │                 │  │ │
│         │  │  tooltip)       │  │                 │  │                 │  │ │
│         │  └─────────────────┘  └─────────────────┘  └────────┬────────┘  │ │
│         │                                                       │          │ │
│         └───────────────────────────────────────────────────────┼──────────┘ │
│                                                                 │            │
└─────────────────────────────────────────────────────────────────┼────────────┘
                                                                  │
                                    chrome.runtime.sendMessage()   │
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND SERVICE WORKER                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Message handlers: LOG_RISK, UPDATE_LOG, STATS_UPDATE, GET_LOGS,     │    │
│  │ GET_STATS, CLEAR_LOGS, DETECTION_FALLBACK                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ chrome.storage.local: riskLogs[], stats{}, settings{}                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Function-by-Function Breakdown

### 4.1 Content Script (`content.js`)

| Function | Purpose | Privacy / Data |
|----------|---------|----------------|
| **init()** | Registers paste, input, file handlers; injects highlight CSS; sets up input monitoring | No data stored. Injects `<style>` into page for highlight rendering. |
| **scanAndAlert(content, source, filename)** | Main orchestrator. Gets full text from input, runs detection, shows UI, logs metadata | **Stored:** Only `{ scanId, timestamp, risks: [{ type, confidence }], source, filename }` – no PII text. |
| **getFallbackRisks(text)** | Runs regex detection (PIIDetector.scan, calculateRisk, detectNames, deduplicateOverlaps) | Text stays in memory; not stored or sent. |
| **logRisk(scanId, risks, source, filename)** | Sends metadata to background via `LOG_RISK` | **Stored:** `type` and `confidence` only – never `risk.text` (the actual PII). |
| **sendStatsUpdate(risks, domain)** | Sends counts to background via `STATS_UPDATE` | **Stored:** `risksFound`, `highRisk`, `mediumRisk`, `domain` (hostname). |
| **updateLog(scanId, userAction)** | Updates log entry when user clicks Update/Dismiss | **Stored:** `userAction` ('fix' or 'dismiss'), `actionTimestamp`. |

### 4.2 PII AI Service (`pii-ai-service.js`)

| Function | Purpose | Privacy / Data |
|----------|---------|----------------|
| **detectPIIWithAI(text)** | Tries Chrome AI first; throws if unavailable so caller uses regex | Text passed to `window.ai` only – runs on device, no network. |
| **tryLocalDetection(text)** | Uses `window.ai.languageModel` (Gemini Nano) if available | **Local only.** Chrome’s built-in AI; no data leaves device. |
| **parseLLMJson(raw)** | Extracts JSON from model output | No storage. |
| **mapEntityToRisk(entity, source)** | Converts AI entity to internal risk shape | No storage; returns `{ text, type, confidence, start, end, risk }` for UI only. |

### 4.3 Handlers

| Handler | Trigger | Data Flow | Privacy |
|----------|---------|-----------|---------|
| **createPasteHandler** | `paste` event | Reads `event.clipboardData.getData('text')` → `scanAndAlert(pastedText, 'paste')` | Pasted text used only for detection; not stored or sent. |
| **createInputHandler** | `input` event | Debounced; calls `scanAndAlert(newValue, 'typing')` | Typed text used only for detection; not stored or sent. |
| **createFileHandler** | `change` on file input | `FileReader.readAsText()` → `scanAndAlert(fileContent, 'file', file.name)` | File content used only for detection; filename stored in log metadata (not content). |

### 4.4 Overlay / UI (`overlay.js`)

| Function | Purpose | Privacy / Data |
|----------|---------|----------------|
| **highlightRisks(inputElement, risks)** | Uses CSS Custom Highlight API + `offsetsToRange()` to underline PII | Ranges created in DOM; no storage. |
| **showInlineSuggestions(...)** | Attaches listeners, stores `riskRanges` in WeakMap per element | State is `{ risk, range }` for tooltip hit-testing; cleared on remove. |
| **applyInlineSuggestion(...)** | Redacts one risk via `detector.redact()` and `setInputValue()` | Modifies input in-place; no storage. |
| **injectHighlightCSS()** | Injects `<style id="ai-guardrail-style">` into document head | No data. |
| **clearHighlights()** | `CSS.highlights.delete('ai-guardrail-highlight')` | No data. |

### 4.5 Background Service Worker (`background.js`)

| Handler | Purpose | Privacy / Data |
|---------|---------|----------------|
| **LOG_RISK** | Appends entry to `riskLogs` (max 500) | **Stored:** `scanId`, `timestamp`, `risks: [{ type, confidence }]`, `source`, `filename`, `userAction`. **Never stores `risk.text`.** |
| **UPDATE_LOG** | Updates `userAction` and `actionTimestamp` for a scan | Metadata only. |
| **STATS_UPDATE** | Increments `stats.total`, `stats.highRisk`, `stats.mediumRisk`, `stats.domains[domain]` | Aggregate counts; domain = hostname (e.g. `chat.openai.com`). |
| **GET_LOGS** | Returns `riskLogs` to popup | Read-only; used for dashboard and DSAR export. |
| **GET_STATS** | Returns `stats` to popup | Read-only. |
| **CLEAR_LOGS** | Sets `riskLogs = []` | User-initiated. |
| **DETECTION_FALLBACK** | No-op; content script may send when AI fails | Not stored; fire-and-forget. |

### 4.6 Popup (`popup/popup.js`)

| Function | Purpose | Privacy / Data |
|----------|---------|----------------|
| **loadStats()** | Fetches `riskLogs` and `stats` via `chrome.storage.local.get` | Reads only; displays in popup. |
| **exportDSAR()** | Exports `riskLogs` as CSV (timestamp, scanId, risk count, types, source, filename, userAction) | **Export contains no PII text** – only metadata. |
| **clearLogs()** | Sets `riskLogs = []` | User-initiated. |

---

## 5. Data Flow (Privacy-Focused)

```
User types/pastes/file
        │
        ▼
┌───────────────────┐
│ Text in memory    │  ← Never stored as-is; never sent over network
└─────────┬─────────┘
          │
          ├─────────────────────────────────────┐
          ▼                                     ▼
┌─────────────────────┐               ┌─────────────────────┐
│ Chrome AI (local)    │               │ Regex (local)       │
│ window.ai.prompt()   │               │ PIIDetector.scan()  │
│ No network           │               │ No network          │
└─────────┬────────────┘               └──────────┬──────────┘
          │                                       │
          └───────────────────┬───────────────────┘
                              ▼
                    ┌─────────────────────┐
                    │ Risks: [{ type,      │
                    │   text, start, end,  │  ← text used only for UI (underline, tooltip)
                    │   confidence }]     │     Never stored in riskLogs
                    └─────────┬───────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ LOG_RISK        │  │ UI (highlights,  │  │ clipboardWrite   │
│ Stored: type,   │  │ pill, tooltip)   │  │ (on Update)      │
│ confidence only │  │                 │  │ User's redacted  │
│ NO risk.text    │  │                 │  │ text → clipboard │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 6. Stored Data Schema

### riskLogs (array, max 500 entries)

```json
{
  "scanId": "scan_1234567890_abc123",
  "timestamp": 1709769600000,
  "ts": 1709769600000,
  "risks": [
    { "type": "email", "confidence": 0.95 },
    { "type": "phone", "confidence": 0.92 }
  ],
  "source": "paste",
  "filename": null,
  "userAction": "fix",
  "actionTimestamp": 1709769610000
}
```

**Note:** `risk.text` (the actual PII string) is **never** stored.

### stats (object)

```json
{
  "total": 42,
  "highRisk": 15,
  "mediumRisk": 27,
  "domains": {
    "chat.openai.com": 20,
    "claude.ai": 12,
    "www.perplexity.ai": 10
  },
  "safeContexts": 0
}
```

### settings (object)

```json
{
  "enabled": true
}
```

---

## 7. Permissions Justification

| Permission | Use | Privacy impact |
|------------|-----|----------------|
| **activeTab** | Access active tab to find chat input, apply redactions, read/write input value | Only when user interacts on a matched site. No broad tab access. |
| **storage** | Store riskLogs, stats, settings in chrome.storage.local | All local; not synced. No external transmission. |
| **clipboardWrite** | Copy redacted text to clipboard when user clicks "Update" | User-initiated; copies only the redacted result. |

**Not requested:** `host_permissions`, `tabs`, `webRequest`, `cookies`, `history`, `bookmarks`.

---

## 8. Content Script Matches

The extension injects only on:

- `https://chat.openai.com/*`, `https://chatgpt.com/*`, `https://www.chatgpt.com/*`
- `https://claude.ai/*`
- `https://www.perplexity.ai/*`
- `https://gemini.google.com/*`
- `https://app.slack.com/*`
- `https://app.intercom.com/*`
- `https://*.zendesk.com/*`
- `https://app.hubspot.com/*`

No `<all_urls>` or broad patterns.

---

## 9. What We Do NOT Do

- ❌ Send user text to any external server
- ❌ Use remote code execution or load scripts from the network
- ❌ Use `eval()` or `new Function()` with user input
- ❌ Store the actual PII strings (emails, names, phones, etc.) in logs
- ❌ Use cookies, analytics, or third-party trackers
- ❌ Request host_permissions (no fetch to external APIs)

---

## 10. Review-sensitive verification

Before submission, confirm the following (verified in codebase):

| Check | Status | Location |
|-------|--------|----------|
| No `host_permissions` | ✅ | manifest.json – not present |
| No `fetch` / XHR to third-party | ✅ | No fetch or XMLHttpRequest in extension src |
| No dynamic script loading | ✅ | No remote script injection |
| No `eval` / `new Function` | ✅ | Grep returns no matches in extension |
| Content script only on listed hosts | ✅ | manifest content_scripts.matches – specific URLs only, no `<all_urls>` |
| Logs never include `risk.text` | ✅ | content.js line 67: `risks.map(r => ({ type: r.type, confidence: r.confidence }))` only |
| Highlight injection is style only | ✅ | Single `<style id="ai-guardrail-style">` for `::highlight()`; no ads or layout takeover |

---

## 11. Test Coverage Assessment

### 11.1 Current Tests (Unit)

| Test file | Coverage | What it tests |
|-----------|----------|---------------|
| `pii-detector.test.js` | PIIDetector | UK postcode, NHS, email, US SSN, US ZIP, Canada postcode, international phone, multiple PII, redaction, mock values, **big chunk (4.5k chars)** |

**Result:** 10 passed, 0 failed.

### 11.2 Is This Enough for Chrome Review?

| Aspect | Status | Recommendation |
|--------|--------|----------------|
| **Core detection logic** | ✅ Covered | PIIDetector regex patterns, redaction, deduplication tested. |
| **Large input** | ✅ Covered | Big-chunk test (4.5k chars) verifies no crash, correct risk count, redaction. |
| **Integration (content ↔ background)** | ⚠️ Not automated | No tests for `scanAndAlert` → `LOG_RISK` → storage. Manual smoke test required. |
| **UI (overlay, pill, tooltip)** | ⚠️ Not automated | No tests for highlight rendering, tooltip, Update/Dismiss. Manual smoke test required. |
| **Chrome AI path** | ⚠️ Not testable in CI | `window.ai` is browser-specific; regex fallback is tested. |
| **Permissions** | ✅ Manifest only | No runtime permission tests; manifest declares minimal set. |

### 11.3 Recommended Manual Tests Before Submission

1. **Load unpacked** from `dist/chrome-mv3` – no errors.
2. **Paste PII** on ChatGPT/Claude/Gemini – underlines + pill appear.
3. **Update** from pill or tooltip – text redacted, clipboard updated.
4. **Dismiss** – underline removed.
5. **Clear all text** – underlines and pill disappear immediately.
6. **Popup** – stats, recent risks, Export DSAR, Clear Logs work.
7. **File upload** – text file scanned, risks shown.

### 11.4 Optional Additional Tests (If Time Permits)

- **rangeMapping.js** – Unit test for `offsetsToRange()` with multi-node DOM.
- **detectionMerger.js** – Unit test for `mergeRisks()`.
- **E2E** – Playwright/Puppeteer for full flow on a test page (optional, not required for review).

---

## 12. Summary for Reviewers

- **Purpose:** PII detection and redaction in AI chat inputs. 100% on-device.
- **Data:** Stores only metadata (risk types, confidence, timestamps, domain names). Never stores actual PII strings.
- **Network:** No external API calls. Chrome AI runs locally; regex runs in content script.
- **Permissions:** Minimal – activeTab, storage, clipboardWrite. All justified.
- **Tests:** Unit tests cover detection and redaction. Manual smoke tests cover UI and integration. Sufficient for initial submission; additional E2E optional.
