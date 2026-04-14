# AI Guardrail – Privacy Policy

**Last updated:** April 2026  
**Extension name:** AI Guardrail  
**Version:** 1.0.4

---

## Data collection disclosure (Chrome Web Store)

This extension **handles personal or sensitive user data** in the following way:

- It **processes text** entered by the user in supported AI chat interfaces (e.g. ChatGPT, Claude, Perplexity, Gemini, Slack) **in order to detect and highlight potential personal information** before it is sent.
- **All text is processed locally within the browser.** The extension **does not transmit this text outside the device** and **no raw prompt text or PII is ever transmitted or persisted**.
- **Only anonymized metadata** is stored locally in `chrome.storage.local`: risk categories (e.g. email, phone, postcode), confidence scores, timestamps, and aggregate counts. **We do not store the underlying messages or any PII strings.**

---

## 1. Overview

AI Guardrail is a Chrome extension that helps you detect and redact personally identifiable information (PII) before you send messages in AI chat interfaces (e.g. ChatGPT, Claude, Perplexity, Gemini). This privacy policy explains what data the extension collects, where it is stored, and how it is used.

**Core principle:** All PII detection and processing happens **on your device**. No text you type or paste is ever sent to external servers.

---

## 2. Data Collection and Storage

### 2.1 What We Store

The extension stores data **only** in Chrome’s local extension storage (`chrome.storage.local`). This storage is:

- **Local to your browser** – not synced to other devices
- **Accessible only by the extension** – websites and other extensions cannot read it
- **Cleared when you uninstall the extension**

We store the following:

| Data type | Purpose | Retention |
|-----------|---------|-----------|
| **Risk logs** | History of scan metadata for the popup dashboard and DSAR export. We store **aggregate counts and risk categories only, not the underlying messages or PII text**. | Up to 500 entries; oldest removed when limit reached |
| **Stats** | Aggregate counts (total risks, high/medium risk, per-domain counts) | Until you clear logs |
| **Settings** | Extension enabled/disabled state | Until you change or uninstall |

### 2.2 Risk Log Entry Structure

Each risk log entry contains:

- **scanId** – Unique identifier for the scan (no user content)
- **timestamp** – When the scan occurred
- **risks** – Array of `{ type, confidence }` only (e.g. `{ type: "email", confidence: 0.95 }`)
  - **We do NOT store the actual PII text** (e.g. email addresses, names, phone numbers)
- **source** – How detection ran: `"paste"`, `"typing"`, or `"file"`
- **filename** – If from a file upload, the file name (optional)
- **userAction** – Your choice: `"fix"` (applied redaction) or `"dismiss"` (ignored)
- **actionTimestamp** – When you took that action

### 2.3 Stats Structure

- **total** – Total number of risks detected across all scans
- **highRisk** – Count of high-risk detections
- **mediumRisk** – Count of medium-risk detections
- **domains** – Object mapping hostname (e.g. `chat.openai.com`) to number of risks detected on that site

---

## 3. How Detection Works (Technical)

### 3.1 Chrome AI (Local, Optional)

When available, the extension uses **Chrome’s built-in AI** (`window.ai` / Gemini Nano) to detect PII. This runs **entirely on your device**:

- Text is processed by the model in your browser
- **No data is sent to Google or any external server**
- If Chrome AI is not available (e.g. not enabled in Chrome), the extension falls back to regex detection

### 3.2 Regex Detection (Local, Always Available)

When Chrome AI is unavailable, the extension uses **pattern-based (regex) detection** that runs in the content script:

- All logic runs in your browser
- **No network requests** for detection
- Detects: emails, phone numbers, postal codes, NHS numbers, SSNs, and names (with context)

### 3.3 No Cloud or External API

The extension **does not** use any cloud API, OpenRouter, or other external service for PII detection. All processing is local.

---

## 4. Permissions and Why We Need Them

| **storage** | Stores risk logs, stats, and settings locally. Required for the popup dashboard and “Clear Logs” / “Export DSAR” features |
| **clipboardWrite** | When you click “Update,” the redacted text is copied to your clipboard so you can paste it if the editor does not accept programmatic replacement |

We do **not** request:

- `host_permissions` for external APIs (we do not call any)
- `tabs` (we operate via content scripts on specific matches)
- `webRequest` or network interception

---

## 5. Where the Extension Runs (Content Script Hosts)

The extension injects a content script only on these sites:

- `https://chat.openai.com/*`, `https://chatgpt.com/*`, `https://www.chatgpt.com/*`
- `https://claude.ai/*`
- `https://www.perplexity.ai/*`
- `https://gemini.google.com/*`
- `https://app.slack.com/*`
- `https://app.intercom.com/*`
- `https://*.zendesk.com/*`
- `https://app.hubspot.com/*`

The extension does **not** run on other websites.

---

## 6. What We Do NOT Do

- **We do not send your text to any server** – detection is 100% local
- **We do not store the actual PII you type** – only risk types and confidence scores
- **We do not track you across sites** – we store domain names only for aggregate stats
- **We do not sell or share data** – there is no data to share; everything stays on your device
- **We do not use cookies or third-party analytics**

---

## 7. Your Controls

### 7.1 Clear Logs

From the extension popup, click **“Clear Logs”** to delete all risk logs. Stats are also reset when you clear logs (via the popup flow).

### 7.2 Export Data (DSAR)

Click **“Export DSAR CSV”** to download a CSV of your risk log entries. This supports data subject access requests (GDPR). The export contains only metadata (types, timestamps, sources) – not the actual PII text.

### 7.3 Uninstall

Uninstalling the extension removes all stored data from `chrome.storage.local`.

---

## 8. Data Security

- All stored data is in Chrome’s extension storage, which is isolated from web pages
- No data is transmitted over the network for detection purposes
- The extension does not execute remote code

---

## 9. Children

The extension is not directed at children. We do not knowingly collect data from children under 13 (or equivalent age in your jurisdiction).

---

## 10. Changes to This Policy

We may update this privacy policy. The “Last updated” date at the top will change. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## 11. Contact

For privacy-related questions or requests, please open an issue in the extension’s repository or contact the developer through the Chrome Web Store listing.

---

## 12. Summary (TL;DR)

- **All PII detection runs on your device** (Chrome AI or regex)
- **No text is sent to external servers**
- **We store only metadata** (risk types, confidence, timestamps, domain names) – not the actual PII
- **You can clear logs and export your data** from the popup
- **Uninstalling removes all data**
