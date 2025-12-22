# 🧪 Local Testing Guide - AI Guardrail Extension

## Quick Start (5 minutes)

### Step 1: Install Dependencies
```bash
cd /Users/renganatharaam/AI-Gaurdilo
npm install
```

### Step 2: Build the Extension
```bash
npm run build
```

**Expected Output:**
```
✓ built in XXXms
```

**Verify build:**
```bash
ls -la dist/chrome-mv3/
```

You should see:
- `content.js`
- `background.js`
- `popup/` folder
- `icons/` folder
- `manifest.json`

### Step 3: Load Extension in Chrome

1. **Open Chrome Extensions Page:**
   - Navigate to: `chrome://extensions/`
   - Or: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode:**
   - Toggle "Developer mode" switch (top right)

3. **Load Unpacked Extension:**
   - Click "Load unpacked" button
   - Navigate to: `/Users/renganatharaam/AI-Gaurdilo/dist/chrome-mv3`
   - Click "Select"

4. **Verify Extension Loaded:**
   - You should see "AI Guardrail" in the extensions list
   - Icon may show as broken (placeholder icons) - that's OK for testing

---

## 🧪 Testing Scenarios

### Test 1: Paste Detection on ChatGPT

1. **Go to:** https://chat.openai.com
2. **Open a new chat**
3. **Paste this text:**
   ```
   Patient John Doe lives at SW1A 1AA. Contact: john.doe@example.com. NHS number: 123 456 7890
   ```

4. **Expected Result:**
   - ✅ Red floating pill appears in top-right corner
   - ✅ Shows "4 risks detected"
   - ✅ Lists risk types: name, postcode, email, nhs_number

5. **Test Fix Button:**
   - Click "Fix" button
   - ✅ Pill shows "✓ Copied!"
   - ✅ Paste in chat → Should see: `[NAME_1] lives at [POSTCODE_1]. Contact: [EMAIL_1]. NHS number: [NHS_NUMBER_1]`

6. **Test Dismiss:**
   - Reload page, paste again
   - Click "Dismiss"
   - ✅ Pill disappears

### Test 2: File Upload on Claude

1. **Go to:** https://claude.ai
2. **Create a text file** (`test-patient.txt`):
   ```
   Patient Report
   Name: Sarah Williams
   Address: M1 1AA, Manchester
   Email: sarah@test.co.uk
   NHS: 234 567 8901
   ```
3. **Upload file** (if Claude supports file uploads)
4. **Expected Result:**
   - ✅ Floating pill appears
   - ✅ Shows filename in pill: "In 'test-patient.txt'"
   - ✅ Lists all detected risks

### Test 3: Input Change Detection

1. **Go to:** https://www.perplexity.ai
2. **Type in search box** (simulate large paste):
   - Select all text in a text editor
   - Copy a large block (50+ characters with PII)
   - Paste into Perplexity search box
3. **Expected Result:**
   - ✅ Detects large input change
   - ✅ Shows pill if PII detected

### Test 4: Popup Dashboard

1. **Click extension icon** in Chrome toolbar
2. **Check Stats:**
   - ✅ "Today" count shows today's detections
   - ✅ "Total" shows all-time count

3. **Check Recent Risks:**
   - ✅ Shows last 10 risks
   - ✅ Shows timestamp, risk types, source

4. **Test Export CSV:**
   - Click "Export DSAR CSV"
   - ✅ Downloads CSV file
   - ✅ Open CSV → Verify columns: Timestamp, Scan ID, Risk Count, etc.

5. **Test Clear Logs:**
   - Click "Clear Logs"
   - ✅ Confirms before clearing
   - ✅ Stats reset to 0

---

## 🐛 Debugging

### Check Console for Errors

1. **Content Script Errors:**
   - Go to any AI site (chat.openai.com)
   - Press `F12` → Console tab
   - Look for "AI Guardrail" messages or errors

2. **Background Script Errors:**
   - Go to `chrome://extensions/`
   - Find "AI Guardrail"
   - Click "service worker" link (if available)
   - Check console for errors

3. **Popup Errors:**
   - Click extension icon
   - Right-click in popup → "Inspect"
   - Check Console tab

### Common Issues

**Issue: Extension doesn't load**
- ✅ Check `dist/chrome-mv3/manifest.json` exists
- ✅ Verify all files copied correctly
- ✅ Check Chrome console for manifest errors

**Issue: Pill doesn't appear**
- ✅ Check content script loaded: Console → Look for "AI Guardrail" logs
- ✅ Verify site matches manifest: `chat.openai.com`, `claude.ai`, `perplexity.ai`
- ✅ Check if site blocks extensions (some sites do)

**Issue: Fix button doesn't copy**
- ✅ Check clipboard permissions in manifest
- ✅ Try manually: Right-click → Inspect → Check console errors
- ✅ Verify `navigator.clipboard` is available (HTTPS required)

**Issue: Storage not working**
- ✅ Check `chrome.storage.local` permissions
- ✅ Open DevTools → Application → Storage → Local Storage
- ✅ Verify logs are being saved

---

## 🔄 Development Workflow

### Watch Mode (Auto-rebuild)

For faster development, you can use watch mode:

```bash
# Terminal 1: Watch for changes
npm run dev

# Terminal 2: After changes, rebuild
npm run build
```

**Note:** Vite's dev mode is for web apps. For extensions, you need to:
1. Make code changes
2. Run `npm run build`
3. Go to `chrome://extensions/`
4. Click reload icon (🔄) on your extension

### Quick Reload Extension

After rebuilding:
1. Go to `chrome://extensions/`
2. Find "AI Guardrail"
3. Click the reload icon (🔄)
4. Refresh the AI site page

---

## ✅ Verification Checklist

After testing, verify:

- [ ] Extension loads without errors
- [ ] Paste detection works on ChatGPT
- [ ] File upload detection works (if site supports)
- [ ] Floating pill appears < 500ms
- [ ] Fix button copies redacted text
- [ ] Dismiss button works
- [ ] Auto-dismiss after 10 seconds
- [ ] Popup shows correct stats
- [ ] Recent risks list populated
- [ ] CSV export works
- [ ] No console errors
- [ ] Storage logs working

---

## 📊 Test Data

Use these test strings for consistent testing:

**Minimal PII:**
```
Patient John Doe, SW1A 1AA
```

**Multiple Types:**
```
Patient: Sarah Williams
Address: M1 1AA, Manchester
Email: sarah@test.co.uk
NHS: 234 567 8901
```

**Context Boost (should increase confidence):**
```
The patient named Robert Johnson lives at B33 8TH. 
Contact email: robert@example.com
```

---

## 🚀 Next Steps

Once local testing passes:
1. Replace placeholder icons (see README.md)
2. Test on all 3 target sites
3. Verify no console errors
4. Prepare for Chrome Web Store submission

