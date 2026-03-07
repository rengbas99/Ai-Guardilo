# 🧪 Local Testing Guide - AI Guardrail Extension

---

## ✅ Pre-deploy checklist (check one by one)

Use this list in order before uploading to the Chrome Web Store. Tick each box when done.

### 1. Run unit tests
- [ ] Open a terminal in the project root: `cd /Users/renganatharaam/AI-Gaurdilo`
- [ ] Run: `bun run test`
- [ ] Confirm output ends with: **`📊 Results: 5 passed, 0 failed`**
- [ ] If any test fails, fix before continuing.

### 2. Build the extension
- [ ] From project root run: `bun run build`
- [ ] Confirm output: `✓ built in ...` (no errors).
- [ ] Check folder exists: `dist/chrome-mv3/`
- [ ] Confirm it contains: `content.js`, `background.js`, `manifest.json`, `popup/` (with `popup.html`, `popup.js`, `popup.css`), `icons/` (icon16.png, icon48.png, icon128.png).

### 3. Load unpacked and smoke test
- [ ] Open Chrome → `chrome://extensions/`
- [ ] Turn **Developer mode** ON (top right).
- [ ] Click **Load unpacked** and select the folder: **`dist/chrome-mv3`** (full path: `/Users/renganatharaam/AI-Gaurdilo/dist/chrome-mv3`).
- [ ] Confirm **AI Guardrail** appears in the list with no red “Errors” badge.
- [ ] Go to **https://chatgpt.com** (or https://claude.ai), open a new chat.
- [ ] Paste this exactly in the message box:
  ```
  John Smith john@email.com SW1A 1AA 07123 456789
  ```
- [ ] **Expect:** Four **dashed red underlines** (name, email, postcode, phone) and a **pill popup** (top-right) showing “4 risks” or similar.
- [ ] Hover over one underline → **Expect:** Tooltip with “Update” and “Dismiss” appears.
- [ ] Click **Update** on the tooltip → **Expect:** That PII is replaced by a placeholder; underlines update.
- [ ] Select all text in the box (Ctrl+A / Cmd+A), then press **Backspace** to delete everything.
- [ ] **Expect:** Underlines and pill disappear **immediately** (no delay).
- [ ] Click the **extension icon** in the toolbar → **Expect:** Popup opens (stats / “No risks” or recent risks).

### 4. Create the zip for Chrome Web Store
- [ ] From project root run:
  ```bash
  cd dist/chrome-mv3 && zip -r ../../ai-guardrail-1.0.0.zip . && cd ../..
  ```
- [ ] Confirm file exists: `ai-guardrail-1.0.0.zip` in the project root.
- [ ] (Optional) Bump version in `extension/manifest.json` for a new release, then rebuild and re-zip with the new version in the filename, e.g. `ai-guardrail-1.1.0.zip`.

### 5. Chrome Web Store submission
- [ ] Go to [Chrome Developer Dashboard](https://developer.chrome.com/docs/webstore/publish) and sign in.
- [ ] Create a **new item** (or choose existing and upload a **new version**).
- [ ] Upload **`ai-guardrail-1.0.0.zip`**.
- [ ] Fill in **Store listing**: short description, detailed description, screenshots (optional but recommended), category.
- [ ] Add **Privacy policy** URL. The full policy is in `PRIVACY_POLICY.md`. Host it (e.g. GitHub Pages, your website) and paste the URL in the listing.
- [ ] Submit for review.

When every step above is checked, you’re ready to publish.

---

## Zero-Leak detection (AI-first, then fallback)

Detection runs in this order:

1. **Local (window.ai / Gemini Nano)** – If `window.ai.languageModel` is available and `capabilities().available === 'readily'`, text is processed on-device (zero data leaves the machine). The popup and tooltip show **Local**.
2. **Cloud (OpenRouter API)** – If local is unavailable, the background script calls OpenRouter (free-tier model: `google/gemini-2.0-flash-001:free`). Requires an OpenRouter API key in storage (see below). The popup shows **Cloud**.
3. **Fallback (regex + UK patterns)** – If neither AI path is used (e.g. no API key for cloud), the built-in regex and UK-specific detectors run. The popup shows **Regex**.

Every response includes a **source** (Local / Cloud / Regex) so you can confirm which path was used.

### How the detector works (AI vs regex)

- **Every scan** tries AI first: local (window.ai) → then cloud (OpenRouter) if local isn’t available.
- **If the AI returns at least one PII entity** → we use that result and the popup shows **Local** or **Cloud**. So in that case the detector **is** using AI.
- **If the AI returns nothing** (local unavailable, no cloud key, or cloud returns empty) → we fall back to the **regex + UK patterns** detector and the popup shows **Regex**. So in that case the detector is **not** using AI.
- **How to tell:** Check the popup badge (Local / Cloud / Regex) or the console log: `Detected risks N source: local|cloud|fallback`.

### Optional: OpenRouter API key (for Cloud fallback)

OpenRouter supports free-tier models, so you can use cloud detection without paying. Pro/paid mode usage is minimal: **one API request per scan** (small payload: your pasted text + system prompt).

To use the Cloud path when local AI is unavailable:

1. Get a free API key from [OpenRouter](https://openrouter.ai/keys).
2. On a supported page, open DevTools → Console and run:
   ```js
   chrome.storage.local.set({ openRouterApiKey: 'YOUR_OPENROUTER_KEY_HERE' });
   ```
3. Reload the page. When local AI is not available, detection will use OpenRouter’s free model.

**Usage:** Each PII scan = 1 request. Free tier has rate limits (e.g. 20/min, 200/day). On OpenRouter Pro, cost per request is small (short text + JSON response).

### API key security (no leak to the page)

Your OpenRouter key is **not** exposed to the website or to the page’s JavaScript:

- **Storage:** The key is stored only in the extension’s `chrome.storage.local`. That storage is **extension‑only**; websites and other extensions cannot read it.
- **Usage:** The key is read and used **only in the background service worker**. The content script never receives the key: it only sends the pasted **text** to the background; the background adds the key and calls OpenRouter, then sends back only the **entities** (no key). So the key never enters the page context or the content script.
- **Network:** The key is sent to OpenRouter in the `Authorization` header over **HTTPS**, so it is encrypted in transit. Only OpenRouter sees it (as with any API key).

**Where to set the key:** Run the `chrome.storage.local.set(...)` command from an **extension** context, not from a random webpage (the page doesn’t have access to extension storage). E.g. right‑click the extension icon → Inspect popup → Console, then run the command there; or use a dedicated options page if you add one.

---

## ⚡ Beta test run (5–10 min)

Do this once after loading the extension to confirm everything works.

1. **Load the extension**
   - Open Chrome → `chrome://extensions/` → Developer mode ON → **Load unpacked** → select folder:  
     **`/Users/renganatharaam/AI-Gaurdilo/dist/chrome-mv3`**
   - Confirm “AI Guardrail” appears and has no errors.

2. **ChatGPT – paste & Update**
   - Go to **https://chat.openai.com** (or https://chatgpt.com), open a new chat.
   - Paste this in the message box:
     ```
     Patient John Doe lives at SW1A 1AA. Contact: john.doe@example.com. NHS: 123 456 7890
     ```
   - **Expect:** A **popup in the top-right** of the window (red header “4 risks detected”, “HIGH RISK”, “From paste”, Types + Local/Cloud/Regex). “Preview Changes:” shows PII in yellow and placeholders in green. **Underlines** under each PII: **green** gradient (medium risk) or **red** gradient (high risk). Popup is fixed to the viewport so it doesn’t misalign on minimize/resize.
   - Click **Update** on the popup → input is replaced with placeholders; popup closes. Redacted text is copied to clipboard.
   - Optional: hover an underline → tooltip (red strikethrough, blue replacement). Click **Update** (that item only) or **🗑 Dismiss** (leave text, remove underline).

3. **Global names**
   - In a new message, paste:
     ```
     Contact María García or Wei Chen for details.
     ```
   - **Expect:** Names underlined (green/red by risk); you can **Update** (replace with [NAME_1], etc.) or **Dismiss**.

4. **Claude or Perplexity (redaction)**
   - Go to **https://claude.ai** (or https://www.perplexity.ai).
   - Paste the same “Patient John Doe…” text in the input.
   - **Expect:** Top-right popup and underlines. Click **Update** → input replaced with redacted text (or paste from clipboard if the editor doesn’t accept programmatic replace).

5. **Extension popup**
   - Click the extension icon → check Total/High/Medium counts and “Recent risks”.
   - **Export DSAR CSV** → file downloads. **Clear Logs** → confirm dialog, then counts reset.

If all steps behave as above, the beta is good to go.

---

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
   - ✅ **Popup in top-right** (fixed to viewport): dark header “🛡️ PII suggestion” with badge **Local**, **Cloud**, or **Regex**
   - ✅ "Preview Changes:" with PII in yellow and placeholders in green (“Improve your text”)
   - ✅ **Underlines** under each PII: **green** (medium) or **red** (high) vertical gradient
   - ✅ Buttons: **✓ Update** and **Ignore**

5. **Test Update (popup):**
   - Click **Update** on the popup
   - ✅ Input text is replaced with placeholders: `[NAME_1] lives at [POSTCODE_1]. Contact: [EMAIL_1]. NHS number: [NHS_NUMBER_1]`
   - ✅ Popup closes; redacted text is copied to clipboard

6. **Test Ignore (popup):**
   - Reload page, paste the same text again
   - Click **Ignore** on the popup
   - ✅ Popup and underlines disappear; text in the input is unchanged

7. **Test inline Update / Dismiss:**
   - Paste PII again; hover over one underlined span
   - **Update** → only that span is replaced with a placeholder
   - **🗑 Dismiss** → that underline and tooltip disappear; that text stays as-is

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
   - ✅ Top-right popup with Local/Cloud/Regex badge
   - ✅ Preview Changes (yellow PII, green placeholders)
   - ✅ Underlines (green/red by risk) on detected PII

### Test 3: Input Change Detection

1. **Go to:** https://www.perplexity.ai
2. **Type in search box** (simulate large paste):
   - Select all text in a text editor
   - Copy a large block (50+ characters with PII)
   - Paste into Perplexity search box
3. **Expected Result:**
   - ✅ Detects large input change
   - ✅ Shows top-right popup and underlines if PII detected

### Test 4: Detection source (Local / Cloud / Regex)

1. **Console check:** On a supported page, paste PII and open DevTools → Console.
2. Look for: `🛡️ AI Guardrail: Detected risks N source: local|cloud|fallback`
3. **Local:** Only when Chrome provides `window.ai` (e.g. Gemini Nano / experimental flags on supported channels).
4. **Cloud:** When local is unavailable and `openRouterApiKey` is set in `chrome.storage.local`.
5. **Fallback:** When neither local nor cloud is used; regex + UK patterns run. Popup badge shows **Regex**.

### Test 5: Popup Dashboard

1. **Click extension icon** in Chrome toolbar
2. **Check Stats:**
   - ✅ "Total" shows all-time risk count
   - ✅ "High" / "Medium" counts shown

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

## 🌐 Platform-by-Platform Testing Guide

Run the extension on each supported platform and verify detection, underlines, popup, and **Update** / **Ignore**. Use the [Master test cases](#-master-test-cases-reference) below on each platform.

### Supported platforms (from manifest)

| Platform   | URL(s)                    | Input type              | Notes                          |
|-----------|---------------------------|-------------------------|--------------------------------|
| ChatGPT   | chat.openai.com, chatgpt.com | textarea / contenteditable | Primary target                 |
| Claude    | claude.ai                 | contenteditable / ProseMirror | Rich editor; Update may need clipboard fallback |
| Perplexity| www.perplexity.ai         | textarea / contenteditable | Search-style input            |
| Slack     | app.slack.com             | contenteditable         | Message composer               |
| Intercom  | app.intercom.com          | textarea / contenteditable | Support chat                  |
| Zendesk   | *.zendesk.com             | textarea / input        | Ticket/reply fields            |
| HubSpot   | app.hubspot.com           | textarea / contenteditable | CRM/chat inputs               |

---

### ChatGPT (OpenAI)

| Step | Action | Test case / input | Expected |
|------|--------|-------------------|----------|
| 1 | Open new chat | Go to https://chat.openai.com or https://chatgpt.com | Page loads |
| 2 | Paste | **TC-NAME-FULL** (see Master test cases) | Popup: "X risks detected"; full name underlined as one span (first + middle + surname); badge Local/Cloud/Regex |
| 3 | Click **Update** | — | Input replaced with redacted text; clipboard has redacted; popup closes |
| 4 | Paste | **TC-MIXED** | Popup shows name, email, postcode, NHS; underlines on each |
| 5 | Click **Ignore** | — | Popup and underlines disappear; text unchanged |
| 6 | Type 50+ chars with PII | **TC-MINIMAL** typed or pasted in chunks | After debounce, scan runs; popup/underlines if PII found |

**Platform notes:** textarea or contenteditable; **Update** should replace content reliably. Check DevTools console for `Detected risks N source: ...`.

---

### Claude (Anthropic)

| Step | Action | Test case / input | Expected |
|------|--------|-------------------|----------|
| 1 | Open chat | https://claude.ai | Composer focused |
| 2 | Paste | **TC-NAME-FULL** | Popup + underlines; **full name** (first + middle + surname) kept as single detection, not replaced by middle name only |
| 3 | Click **Update** | — | Composer content replaced with redacted text; redacted also on clipboard (paste again if editor didn’t update) |
| 4 | Paste | **TC-MIXED** | All PII types detected and underlined |
| 5 | Inline tooltip | Hover one underline → **Update** | Only that span replaced with placeholder |
| 6 | Inline tooltip | Hover → **Dismiss** | That underline/tooltip removed; text unchanged |

**Platform notes:** contenteditable/ProseMirror. If **Update** doesn’t replace the field, use Cmd+V / Ctrl+V to paste from clipboard (redacted text was copied). Underline alignment on contenteditable can be approximate; full fix uses `Range.getClientRects()`.

---

### Perplexity

| Step | Action | Test case / input | Expected |
|------|--------|-------------------|----------|
| 1 | Open search | https://www.perplexity.ai | Search/ask input visible |
| 2 | Paste | **TC-NAME-FULL** | Popup + underlines; full name as one span |
| 3 | Click **Update** | — | Input replaced with redacted; clipboard updated |
| 4 | Paste | **TC-EMAIL**, **TC-PHONE**, **TC-POSTCODE** in one block | All detected; popup shows types; underlines on each |
| 5 | Large paste | **TC-MIXED** (50+ chars) | Scan triggers; popup and underlines appear |

**Platform notes:** textarea or contenteditable. Same expectations as ChatGPT for replace and clipboard.

---

### Slack

| Step | Action | Test case / input | Expected |
|------|--------|-------------------|----------|
| 1 | Open workspace | https://app.slack.com | Channel or DM open |
| 2 | Focus message box | Click in composer | Cursor in contenteditable |
| 3 | Paste | **TC-MIXED** | Popup + underlines |
| 4 | Click **Update** | — | Message box content replaced with redacted; clipboard has redacted |
| 5 | Paste | **TC-NAME-CONTEXT** | "patient named" triggers context boost; name detected |

**Platform notes:** Message composer is contenteditable. Confirm extension content script runs (check console on app.slack.com).

---

### Intercom

| Step | Action | Test case / input | Expected |
|------|--------|-------------------|----------|
| 1 | Open Intercom | https://app.intercom.com | Chat or reply field focused |
| 2 | Paste | **TC-MINIMAL** | Popup + underlines (name, postcode) |
| 3 | Click **Update** / **Ignore** | — | Update replaces; Ignore clears UI |

**Platform notes:** Same flow as other platforms; input may be textarea or contenteditable depending on widget.

---

### Zendesk

| Step | Action | Test case / input | Expected |
|------|--------|-------------------|----------|
| 1 | Open Zendesk | Any https://*.zendesk.com (e.g. support.yourcompany.zendesk.com) | Ticket or reply form |
| 2 | Paste in reply/description | **TC-MIXED** | Detection runs; popup + underlines |
| 3 | **Update** | — | Field content and clipboard redacted |

**Platform notes:** Multiple text areas; paste in the one you’re replying with. Extension matches all *.zendesk.com.

---

### HubSpot

| Step | Action | Test case / input | Expected |
|------|--------|-------------------|----------|
| 1 | Open HubSpot | https://app.hubspot.com | Chat, CRM, or form |
| 2 | Paste in a text field | **TC-MIXED** or **TC-NAME-FULL** | Popup + underlines |
| 3 | **Update** / **Ignore** | — | Same behavior as other platforms |

**Platform notes:** Various inputs across app; use any textarea or contenteditable that accepts paste.

---

## 📋 Master test cases reference

Use these exact strings for consistent testing across all platforms. Each ID is a test case you can paste or type.

| ID | Description | Test string | Expected detection |
|----|-------------|-------------|---------------------|
| **TC-NAME-FULL** | Full name (first + middle + surname) | `Contact Renganatha Raam Baskar for details.` | One name span: **Renganatha Raam Baskar** (not only "Raam"). Verifies middle/surname and overlap dedup. |
| **TC-NAME-FIRST-LAST** | First + last only | `Patient John Doe lives at SW1A 1AA.` | **John Doe** (name), **SW1A 1AA** (postcode) |
| **TC-NAME-TITLE** | Title + full name | `Dr. Sarah Williams will see you.` | **Sarah Williams** (or full phrase with title depending on pattern) |
| **TC-NAME-CONTEXT** | Context keyword + name | `The patient named Robert Johnson is here.` | **Robert Johnson** (context boost) |
| **TC-NAME-GLOBAL** | Non-Latin / global names | `Contact María García or Wei Chen for details.` | **María García**, **Wei Chen** |
| **TC-MINIMAL** | Minimal PII | `Patient John Doe, SW1A 1AA` | 1 name, 1 postcode |
| **TC-EMAIL** | Email only | `Reply to john.doe@example.com` | 1 email |
| **TC-PHONE** | Phone only | `Call +44 20 7946 0958` or `555-123-4567` | 1 phone |
| **TC-POSTCODE** | UK postcode | `Address: M1 1AA, Manchester` | 1 postcode (UK) |
| **TC-NHS** | UK NHS number | `NHS number: 123 456 7890` | 1 NHS (if valid checksum in test data) |
| **TC-SSN** | US SSN | `SSN: 123-45-6789` | 1 SSN |
| **TC-MIXED** | Multiple PII types | `Patient John Doe lives at SW1A 1AA. Contact: john.doe@example.com. NHS: 123 456 7890` | Name, postcode, email, NHS (4 risks) |
| **TC-NO-PII** | No PII (sanity) | `The quick brown fox jumps over the lazy dog.` | No popup, no underlines |
| **TC-FALSE-POSITIVE** | Capitalized non-names | `Meeting on Monday in New York.` | Ideally no name; "Monday"/"New York" may be filtered by false-positive list |

### Name-specific regression (middle / surname)

After the overlap fix, this must pass on every platform:

- **Input:** `Contact Renganatha Raam Baskar for details.`
- **Expected:** Exactly **one** name detection: **Renganatha Raam Baskar** (full span). The single word "Raam" must not replace the full name (longer span wins when confidences are within 0.1).

---

## 🛡️ UI summary

- **Underlines:** Vertical gradient (180°) under each PII span: **green** (medium risk) or **red** (high risk). No animation.
- **Top-right popup:** Fixed to viewport (`top: 20px; right: 20px`) so it doesn’t misalign on minimize or resize. Red header “X risks detected”, “HIGH RISK”, “From paste” / filename, Types + Local/Cloud/Regex. “Preview Changes:” with yellow PII and green placeholders. **✓ Update** and **Ignore**.
- **Inline tooltip:** On hover over an underline: dark header + source, red strikethrough, blue replacement. **Update** (that span only) and **🗑 Dismiss**.

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

**Issue: Popup or underlines don't appear**
- ✅ Check content script loaded: Console → Look for "AI Guardrail" logs and "Detected risks" with source (local/cloud/fallback)
- ✅ Verify site matches manifest: `chat.openai.com`, `claude.ai`, `perplexity.ai`
- ✅ Check if site blocks extensions (some sites do)
- ✅ For Cloud: ensure `openRouterApiKey` is set in `chrome.storage.local` if you expect cloud fallback

**Issue: Update doesn't replace text (Claude/Perplexity)**
- ✅ Redacted text is still copied to clipboard — paste (Ctrl+V / Cmd+V) to replace manually
- ✅ Check console for "AI Guardrail: Text replaced in input field" or errors
- ✅ Some rich editors ignore programmatic updates; clipboard fallback is expected on those sites

**Issue: Update button doesn't copy / replace**
- ✅ Check clipboard permissions in manifest
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
- [ ] **Full name (first + middle + surname)** detected as one span; not replaced by middle name only (TC-NAME-FULL)
- [ ] File upload detection works (if site supports)
- [ ] **Top-right popup** appears (fixed to viewport; doesn’t misalign on minimize), with Local/Cloud/Regex
- [ ] **Underlines** use vertical gradient: green (medium risk) and red (high risk), no animation
- [ ] Update button replaces text and copies redacted to clipboard
- [ ] Ignore removes popup and underlines
- [ ] Inline tooltip shows red strikethrough and blue placeholder; Update/Dismiss work per span
- [ ] Auto-dismiss after ~15 seconds
- [ ] Extension popup shows correct stats
- [ ] Recent risks list populated
- [ ] CSV export works
- [ ] No console errors
- [ ] Storage logs working

---

## 📊 Test Data

Use these test strings for consistent testing. They align with the [Master test cases](#-master-test-cases-reference) above.

**TC-NAME-FULL (first + middle + surname):**
```
Contact Renganatha Raam Baskar for details.
```

**TC-MINIMAL:**
```
Patient John Doe, SW1A 1AA
```

**TC-MIXED (multiple types):**
```
Patient John Doe lives at SW1A 1AA. Contact: john.doe@example.com. NHS: 123 456 7890
```

**Multiple Types (alternate):**
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

**TC-NAME-GLOBAL:**
```
Contact María García or Wei Chen for details.
```

**TC-NO-PII (sanity check):**
```
The quick brown fox jumps over the lazy dog.
```

---

## 📋 Launch checklist – what’s done and what’s left

### Done
- **Zero-leak detection:** Local AI (window.ai) → Cloud (OpenRouter) → Regex/UK fallback; source shown (Local/Cloud/Regex).
- **UI:** Top-right popup (fixed), underlines (green/red by risk), inline tooltips, **Update** / **Ignore**.
- **Paste handling:** Pasted text is used as the scan input; when the paste target is a contenteditable or input/textarea, underlines and **Update** apply to that element. Overlay and popup stay aligned on resize/scroll.
- **Clear on delete:** Typing/deleting uses current input text; when PII is removed, underlines and popup clear (150 ms debounce).
- **Name detection:** Global short names (e.g. Wei, Chen), case-insensitive.
- **API key:** Stored only in extension storage; used only in background; not exposed to the page.

### Before launch
1. **Icons** – Replace placeholders in `extension/icons/` (e.g. red shield) for the store listing.
2. **E2E test** – Paste PII on **Claude** (and Perplexity/Gemini). Confirm: popup shows, underlines sit on the pasted content, **Update** redacts the correct block.  
   - *Note:* On some UIs, pasted content may appear in a separate “PASTED” block. We use the paste **event target** when it’s an input/textarea/contenteditable; if the site renders paste elsewhere, **Update** may still target the main input. Manual paste-from-clipboard after **Update** is a fallback.
3. **Verification** – Run through this guide’s verification checklist (Zero-Leak, popup, underlines, Update/Ignore, extension popup, Export/Clear).
4. **Chrome Web Store** – Pack the extension (`dist/chrome-mv3`), prepare listing (description, screenshots), privacy policy if required, then submit.

