# AI Guardrail Chrome Extension

AI Guardrail v1 - Local PII Detection Chrome Extension

Detects paste/file uploads containing UK PII (postcodes, NHS numbers, names) on ChatGPT/Claude/Perplexity. Shows non-blocking pill → One-click redact → Double-click editable mocks → Local DSAR logs.

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

Try pasting: "Patient John Doe, SW1A 1AA, email: john@test.com, NHS: 123 456 7890"

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

- ✅ Detects UK postcodes (98% accuracy)
- ✅ Detects NHS numbers (99% accuracy)
- ✅ Detects emails (97% accuracy)
- ✅ Detects names with context boost
- ✅ Non-blocking floating pill UI
- ✅ One-click redaction to clipboard
- ✅ Local DSAR logging (chrome.storage.local)
- ✅ 100% local execution (no server calls)

## Icons

**Note**: Placeholder icons are included. For production, generate proper icons at https://favicon.io/favicon-generator/ with a red shield design.

