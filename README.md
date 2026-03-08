# 🛡️ AI Guardrail

**Stop PII leaks before they hit the AI.** A Chrome extension that scans your text in real time, underlines sensitive data, and lets you redact with one click—all **100% on your device**. No cloud. No API calls. No data leaves your browser.

---

## Why it exists

You paste a patient letter into ChatGPT. A support ticket into Claude. A contract snippet into Perplexity. Names, emails, NHS numbers, bank details—they’re all in there. AI Guardrail catches them *before* you hit send, so you stay in control of what gets shared.

---

## What it detects

| Type | Examples |
|------|----------|
| **Names** | John Smith, Dr Sarah Jones, María García |
| **Emails** | john@company.co.uk |
| **Phones** | +44 7700 900123, 07700 900123 |
| **Postcodes** | SW1A 1AA, E1 6AN |
| **NHS numbers** | 485 777 3456 |
| **NI numbers** | AB123456C |
| **Bank details** | Sort code 40-47-84, Account 12345678 |
| **Card numbers** | Visa, Mastercard (with Luhn validation) |
| **VAT numbers** | GB123456789 |

Detection runs via **Chrome AI (Gemini Nano)** when available, with a **regex fallback** when it isn’t. Both run locally.

---

## How it works

```
Paste / Type / Upload  →  Detect PII  →  Underline  →  Update or Ignore
         │                    │              │
         │                    │              └── One-click redact or dismiss
         │                    └── Chrome AI or regex (local only)
         └── Works on ChatGPT, Claude, Perplexity, Gemini, Slack, Intercom, Zendesk, HubSpot
```

1. **Paste** – Paste into a chat input → scan runs on the pasted text.
2. **Type** – Debounced scan while you type.
3. **Upload** – Drop a file → scan runs on file contents.
4. **Underlines** – Dashed underlines on detected PII.
5. **Hover** – Tooltip with type and placeholder suggestion.
6. **Update** – Replace with `[NAME_1]`, `[EMAIL_1]`, etc.
7. **Ignore** – Dismiss that detection.

---

## Project structure

```
extension/
├── src/
│   ├── content.js           # Orchestrator: wires handlers, detection, and UI
│   ├── background.js        # Service worker: stats, risk logs, storage
│   │
│   ├── handlers/            # Input sources
│   │   ├── pasteHandler.js  # Paste events → scan
│   │   ├── inputHandler.js # Typing (debounced) → scan
│   │   └── fileHandler.js   # File upload → scan
│   │
│   ├── services/
│   │   ├── pii-ai-service.js   # Chrome AI (window.ai) detection
│   │   └── detectionMerger.js  # Merges AI + regex results
│   │
│   ├── utils/
│   │   ├── detectors/       # Regex detectors (UK-focused)
│   │   │   ├── index.js     # detectUKPII() – runs all detectors
│   │   │   ├── nhs.js       # NHS numbers
│   │   │   ├── ni.js        # NI numbers
│   │   │   ├── bank.js      # Sort code, account, combined
│   │   │   ├── card.js      # Visa, Mastercard (Luhn)
│   │   │   ├── email.js     # Email addresses
│   │   │   ├── phone.js     # UK phone formats
│   │   │   ├── postcode.js  # UK postcodes
│   │   │   ├── vat.js       # UK VAT
│   │   │   └── name.js      # Names (context-aware)
│   │   ├── input.js         # getInputElement() – finds chat inputs
│   │   ├── rangeMapping.js  # DOM ↔ text offset mapping (ProseMirror-safe)
│   │   └── context.js       # Chrome AI availability check
│   │
│   ├── ui/
│   │   ├── overlay.js       # Underlines + tooltip (rect-based, per-input)
│   │   └── popup.js         # Body pill ("3 risks found")
│   │
│   └── state/
│       └── scanState.js     # Scan IDs, paste target, overlay target
│
├── popup/
│   ├── popup.html           # Extension popup (stats, clear logs, export)
│   ├── popup.js             # Popup logic
│   └── popup.css            # Popup styles
│
├── icons/                   # 16, 48, 128px icons
└── manifest.json            # MV3 manifest
```

---

## Scripts

| Command | What it does |
|---------|--------------|
| `bun run build` | Build extension → `dist/chrome-mv3/` |
| `bun run test` | Run PII detector tests |
| `bun run dev` | Vite dev server (for popup/preview) |

---

## Setup

```bash
bun install
bun run build
```

Then in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `dist/chrome-mv3`

---

## Supported sites

- ChatGPT (chat.openai.com, chatgpt.com)
- Claude (claude.ai)
- Perplexity (perplexity.ai)
- Gemini (gemini.google.com)
- Slack (app.slack.com)
- Intercom (app.intercom.com)
- Zendesk (*.zendesk.com)
- HubSpot (app.hubspot.com)

---

## Privacy

- **No text sent to servers** – detection runs in your browser.
- **No cloud APIs** – Chrome AI or regex only.
- **Local storage** – risk metadata (type, confidence) in `chrome.storage.local`.
- **No PII stored** – only counts and categories for the popup and DSAR export.

[Full privacy policy →](docs/privacy.html)

---

## License

MIT
