# Chrome Web Store – Beta launch checklist (~2 hours)

Use this to ship a **beta** (unlisted or limited test) in one short session.

---

## 1. Developer account (one-time, ~5 min)

- Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
- Pay the **one-time $5** registration fee if you haven’t already.
- Complete identity verification if prompted.

---

## 2. Package the extension (~2 min)

```bash
cd /Users/renganatharaam/AI-Gaurdilo
npm run build
```

Zip **only** the built folder (Chrome expects the zip to contain `manifest.json` at the root):

```bash
cd dist/chrome-mv3
zip -r ../ai-guardrail-beta.zip . -x "*.DS_Store"
```

Upload **`dist/ai-guardrail-beta.zip`** in the developer dashboard.

---

## 3. Store listing (required)

- **Short description** (max 132 chars): e.g.  
  `Detects PII in AI chats. Underline names, emails, postcodes, NHS numbers. One-click redact or ignore. 100% local.`
- **Detailed description**: What it does, where it works (ChatGPT, Claude, Perplexity, Slack, etc.), that it’s local-only and no data is sent to servers.
- **Category**: e.g. “Productivity”.
- **Language**: Primary language (e.g. English).
- **Screenshots**: At least 1 (1280×800 or 640×400). Optional: 2–3 showing pill, underlines, popup.
- **Small promo tile** (optional for beta): 440×280.
- **Icon**: 128×128 (you have `extension/icons/icon128.png`).

---

## 4. Privacy & permissions

- **Privacy policy URL** is **required**. Host a single page that states:
  - No PII or text is sent to any server; all detection and redaction runs in the browser.
  - Optional: “We store risk metadata (e.g. risk type, count) locally in Chrome storage for the DSAR export feature.”
- **Permissions**: You already use `activeTab`, `storage`, `clipboardWrite`. The dashboard will list them; no extra steps if the manifest is unchanged.

---

## 5. Submit for review

- Choose **“Submit for review”**.
- For a **beta**, you can use **“Unlisted”** so only people with the link can install, or limit visibility in the dashboard if the option exists.
- Review usually takes from a few hours to a few days. Beta doesn’t speed up review but keeps the audience small.

---

## 6. Beta-specific (optional)

- In the listing, you can add “BETA” in the short description or title so users know it’s early.
- No need for a separate “beta” package; the same zip can be the first version (e.g. 1.0.0). You can bump to 1.1.0 when you add the global name + Update/Ignore changes and submit an update.

---

## 7. Quick pre-submit check

- [ ] `npm run build` completes without errors.
- [ ] Load unpacked from `dist/chrome-mv3` in Chrome and test paste + pill + Update/Ignore on one site.
- [ ] Privacy policy URL is live and linked in the dashboard.
- [ ] Zip contains `manifest.json` at root (no parent folder inside the zip).

---

**Realistic timeline:** Account + packaging + listing + privacy page ≈ **30–60 min**. Review wait is **hours to 1–3 days**. So “launch beta today” = submit today; the extension can go live after approval.
