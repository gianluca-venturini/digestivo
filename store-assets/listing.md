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
Add (+) and (++) buttons to Hacker News that summarize any linked article, using your own OpenRouter key. No server.
```

---

## Detailed description
_(max 16,000 characters — plain text)_

```
HN Summary adds two small buttons — (+) for a short TL;DR and (++) for a longer bulleted summary — next to every story on Hacker News. Click one and read the gist of the linked article without leaving the front page.

It runs entirely in your browser. There is no server and no account: you bring your own OpenRouter key, so you stay in control of usage and cost.

FEATURES
• (+) short summary and (++) long summary buttons on every story.
• Summaries render inline, right under the story, styled to match Hacker News.
• Click (-) / (--) to collapse a summary again.
• Works on the front page and all list/item pages; text posts (Ask HN, etc.) summarize their discussion.
• Summaries are cached locally, so re-opening one is instant and doesn't spend tokens again.
• Pick any model from OpenRouter's catalog in the settings popup.
• Clear, in-place error messages if a fetch or model call fails.
• Big enough tap targets to use on mobile.

HOW IT WORKS
1. Your browser downloads the linked page directly, without cookies.
2. The extension finds the article text locally, in your browser.
3. That text is summarized by the OpenRouter model you chose, using your key.
No other service is used.

WHAT YOU NEED
• An OpenRouter API key — https://openrouter.ai/keys
Add it in the extension's popup and pick a model. Until then the buttons stay disabled (they'll tell you what's missing on hover).

PRIVACY
No analytics, no tracking, no data sold. Your key is stored locally on your device and is sent only to OpenRouter. The article text is sent only to OpenRouter to make the summary. See the privacy policy for details.
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
The extension uses chrome.storage.local to save, only on the user's own device: (1) the user's OpenRouter API key, (2) the model they selected, and (3) cached summaries. Persisting the keys and model lets the extension tell whether it is configured (otherwise its buttons stay disabled) and saves the user from re-entering keys every session. Caching a generated summary means re-opening it is instant and avoids making a duplicate, paid API call. Using storage sends nothing to any server — the data never leaves the device. Storage is required for the single purpose, because the summarization feature cannot run without the user's stored keys and chosen model.
```

## Host permission justification
_(max 1,000 characters — one field covering every match pattern in "permissions" and "content_scripts")_

```
The content script runs only on https://news.ycombinator.com/*, to add the (+) and (++) buttons and show summaries inline.
http://*/* and https://*/* are needed because the article a Hacker News story links to can be on any website. When the user clicks (+) or (++), the background script downloads only that one article, without cookies, so the extension can read its text. A content script cannot read other websites, so this must happen in the background. No page is fetched unless the user clicks a button, and local network addresses are refused.
The same patterns cover https://openrouter.ai/*, which receives the article text to make the summary with the user's own key, and provides the public model list for the settings popup.
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
its scripts. OpenRouter returns JSON data, which is never executed as code.

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
  - Authentication information — the user's OpenRouter API key (stored locally; sent only to OpenRouter).
  - Website content — the linked page's text (sent only to OpenRouter to produce the summary).
- Certify all three statements:
  - Not being sold to third parties, outside of the approved use cases.
  - Not being used or transferred for purposes unrelated to the item's single purpose.
  - Not being used or transferred to determine creditworthiness or for lending purposes.
