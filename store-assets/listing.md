# Chrome Web Store listing — copy/paste

Paste each field into the corresponding box in the Developer Dashboard.
Store descriptions are plain text (no Markdown rendering), so paste the text as-is.

---

## Item name
`HN Summary`

## Category
`Productivity`

## Language
`English (United States)`

---

## Short description
_(max 132 characters)_

```
Add (+) and (++) buttons to Hacker News that summarize any linked article on your device. No key, no server.
```

---

## Detailed description
_(max 16,000 characters — plain text)_

```
HN Summary adds two small buttons — (+) for a short TL;DR and (++) for a longer bulleted summary — next to every story on Hacker News. Click one and read the gist of the linked article without leaving the front page.

It runs entirely in your browser. There is no server, no account, and no key to add: by default, summaries are made on your device by Chrome's built-in AI (Gemini Nano). For better quality, you can select OpenRouter and use your own key.

FEATURES
• (+) short summary and (++) long summary buttons on every story.
• Summaries render inline, right under the story, styled to match Hacker News.
• Click (-) / (--) to collapse a summary again.
• Works on the front page and all list/item pages; text posts (Ask HN, etc.) summarize their discussion.
• Summaries are cached locally, so re-opening one is instant and doesn't spend tokens again.
• Summaries on your device by default: free, and the article text does not leave your browser.
• Optional: pick any model from OpenRouter's catalog in the settings popup.
• Clear, in-place error messages if a fetch or model call fails.
• Big enough tap targets to use on mobile.

HOW IT WORKS
1. Your browser downloads the linked page directly, without cookies.
2. The extension finds the article text locally, in your browser.
3. Chrome's built-in model summarizes that text on your device. Or, if you select OpenRouter, the OpenRouter model you chose summarizes it, using your key.
No other service is used.

WHAT YOU NEED
• Nothing, in Chrome 138 or newer on Windows, macOS, Linux, or a Chromebook Plus. Chrome downloads its on-device model one time (it needs 22 GB of free disk space, and a GPU with more than 4 GB of memory or 16 GB of RAM).
• For other browsers and devices, or for better quality: an OpenRouter API key — https://openrouter.ai/keys. Select OpenRouter in the extension's popup, add the key, and pick a model.

PRIVACY
No analytics, no tracking, no data sold. With the on-device engine, the article text does not leave your device. If you select OpenRouter, your key is stored locally on your device and is sent only to OpenRouter, and the article text is sent only to OpenRouter to make the summary. See the privacy policy for details.
```

---

# Privacy practices tab — exact form fields

## Single purpose

```
Summarize the article linked from a Hacker News story, and show the summary inline on the Hacker News page.
```

## storage justification
_(max 1,000 characters)_

```
The extension uses chrome.storage.local to save, only on the user's own device: (1) the summary engine the user selected (on-device or OpenRouter), (2) if they use OpenRouter, their OpenRouter API key and model, and (3) cached summaries. Persisting these lets the extension use the selected engine and saves the user from re-entering the key every session. Caching a generated summary means re-opening it is instant and avoids doing the same work again. Using storage sends nothing to any server — the data never leaves the device. Storage is required for the single purpose, because the summarization feature cannot run without the user's stored engine choice (and, for OpenRouter, the key and model).
```

## Host permission justification
_(max 1,000 characters — one field covering every match pattern in "permissions" and "content_scripts")_

```
The content script runs only on https://news.ycombinator.com/*, to add the (+) and (++) buttons and show summaries inline.
http://*/* and https://*/* are needed because the article a Hacker News story links to can be on any website. When the user clicks (+) or (++), the background script downloads only that one article, without cookies, so the extension can read its text. A content script cannot read other websites, so this must happen in the background. No page is fetched unless the user clicks a button, and local network addresses are refused.
The same patterns cover https://openrouter.ai/*. Only if the user selects OpenRouter, it receives the article text to make the summary with the user's own key, and provides the public model list for the settings popup. By default, summaries are made on the device by Chrome's built-in Summarizer API, and the article text is sent nowhere.
No browsing history or personal data is collected.
```

## Are you using remote code?

```
Select: "No, I am not using Remote code."
```

Why (for your own reference — no justification box appears when you select No):
All JavaScript is packaged inside the extension (content scripts including the
vendored Defuddle library, the background script, and the popup scripts). There
are no external `<script>` tags, no modules importing external files, and no
`eval()`. The fetched article HTML is parsed with `DOMParser`, which never runs
its scripts. OpenRouter returns JSON data, which is never executed as code. The on-device model is
Chrome's own built-in model, which Chrome downloads and runs; the extension ships no model.

## Privacy policy

- Does this extension collect user data? **Yes** (it handles the user's API keys
  and the linked page's content), so a privacy policy is required.
- Privacy policy URL — host `PRIVACY.md` publicly (GitHub repo, GitHub Pages, or
  a gist) and paste its URL here:

```
<paste the public URL where you host PRIVACY.md>
```

## Data collection disclosures
_(Data collection section of the same tab — select the matching types)_

- Types collected/used:
  - Authentication information — the user's OpenRouter API key, if they select OpenRouter (stored locally; sent only to OpenRouter).
  - Website content — the linked page's text (summarized on the device by default; sent only to OpenRouter if the user selects OpenRouter).
- Certify all three statements:
  - Not being sold to third parties, outside of the approved use cases.
  - Not being used or transferred for purposes unrelated to the item's single purpose.
  - Not being used or transferred to determine creditworthiness or for lending purposes.
