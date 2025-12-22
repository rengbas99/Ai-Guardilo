# 🚀 Quick Start - Run & Test Locally

## 3-Step Setup (2 minutes)

### 1️⃣ Install & Build
```bash
cd /Users/renganatharaam/AI-Gaurdilo
npm install
npm run build
```

✅ **Success looks like:**
```
✓ built in 85ms
```

### 2️⃣ Load in Chrome

1. Open `chrome://extensions/`
2. Toggle **"Developer mode"** (top right)
3. Click **"Load unpacked"**
4. Select: `/Users/renganatharaam/AI-Gaurdilo/dist/chrome-mv3`

✅ Extension should appear in list (icon may be broken - that's OK)

### 3️⃣ Test It!

**Go to:** https://chat.openai.com

**Paste this:**
```
Patient John Doe, SW1A 1AA, email: john@test.com, NHS: 123 456 7890
```

✅ **You should see:**
- Red floating pill in top-right corner
- "4 risks detected"
- Click "Fix" → Text copied to clipboard (redacted)

---

## 🔄 After Code Changes

```bash
npm run build
```

Then in Chrome:
- Go to `chrome://extensions/`
- Click reload icon (🔄) on "AI Guardrail"
- Refresh the AI site page

---

## 🐛 Troubleshooting

**Build fails?**
- Check: `node --version` (need Node 16+)
- Try: `rm -rf node_modules && npm install`

**Extension doesn't load?**
- Check: `dist/chrome-mv3/manifest.json` exists
- Check Chrome console: `chrome://extensions/` → "Errors" button

**Pill doesn't appear?**
- Open DevTools (F12) → Console tab
- Look for "AI Guardrail" messages
- Verify you're on: `chat.openai.com`, `claude.ai`, or `perplexity.ai`

---

## 📚 Full Testing Guide

See `TESTING_GUIDE.md` for detailed test scenarios.

