# AI Guardrail Chrome Extension

**Global GDPR PII redactor** – detects and redacts personally identifiable information in AI chat interfaces. No sector or region limit: names (any language), emails, international phone numbers, postal codes (US, UK, Canada, EU), national IDs (US SSN, UK NHS, EU VAT, etc.). 100% local; no data sent to servers.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dist/chrome-mv3` folder

## Testing

Test on:
- https://chat.openai.com
- https://claude.ai
- https://www.perplexity.ai

Try pasting: "Contact María García, +1 555 123 4567, john@test.com, 10001. SSN: 123-45-6789"

## Structure

```
extension/
  src/
    content.js          # Main content script
    background.js       # Service worker
    utils/
      pii-detector.js  # PII detection engine
  popup/
    popup.html         # Dashboard UI
    popup.js           # Dashboard logic
    popup.css          # Dashboard styles
  icons/               # Extension icons
  manifest.json        # Extension manifest

dist/chrome-mv3/       # Built extension (after npm run build)
```

## Features

- ✅ **Global GDPR PII** – names (any language), emails, international phones, postal/ZIP (US, UK, CA, DE, FR, NL), national IDs (US SSN, UK NHS), EU VAT/sort codes
- ✅ Non-blocking pill + inline underlines (Update / Ignore per item)
- ✅ One-click redaction to clipboard and input
- ✅ Local DSAR-style logs (chrome.storage.local)
- ✅ 100% local execution (no server calls)

## Icons

**Note**: Placeholder icons are included. For production, generate proper icons at https://favicon.io/favicon-generator/ with a red shield design.

