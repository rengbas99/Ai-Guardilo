# Chrome Web Store – Listing & Disclosure Copy

Use this text when filling the Chrome Web Store listing and privacy declaration.

---

## 1. Single declaration (handles sensitive data)

In the Chrome Web Store dashboard, when asked whether the extension handles personal or sensitive user data, **select Yes** and use this wording (or equivalent):

> This extension processes text entered by the user in supported AI chat interfaces to detect and highlight potential personal information before it is sent. All text is processed locally in the browser. No text is transmitted to external servers. Only anonymized metadata (risk type and confidence) is stored locally. The extension does not store the actual PII text.

---

## 2. Short description (132 characters max)

```
Scans text in AI chat interfaces to detect and redact personal data before sending. 100% local; no data sent to servers.
```

(Length: 98 characters)

---

## 3. Detailed description

```
This extension scans text entered into supported AI chat interfaces (such as ChatGPT, Claude, Perplexity, Gemini, and Slack) to detect and redact personal data before you send it.

• All detection runs on your device: Chrome's on-device AI (when available) or local pattern matching. No text is sent to external servers.
• Only anonymized metadata (e.g. risk type and confidence score) is stored locally in the browser. We do not store your messages or any PII strings.
• clipboardWrite is used only when you click "Update" to copy the redacted text to your clipboard.
• If you upload text files in supported chat interfaces, the extension may scan file contents locally to detect personal information before submission. File content is not sent to any server.
```

---

## 4. Privacy policy URL

Host your `PRIVACY_POLICY.md` (e.g. as a page on GitHub Pages or your website) and paste that URL in the Store’s “Privacy policy” field. The policy already includes the required Data collection disclosure.

---

## 5. Notes to reviewer (optional)

If the Store provides a field for notes to the reviewer, you can add:

```
This extension only injects on the host URLs listed in the manifest (e.g. chat.openai.com, claude.ai). It does not use host_permissions or fetch to external APIs. activeTab is used for interaction with the active tab when the user applies redactions. All PII detection is on-device (Chrome AI or regex). Logs store only risk type and confidence, never the actual PII text. See CHROME_EXTENSION_REVIEW.md in the package or repository for full technical breakdown.
```
