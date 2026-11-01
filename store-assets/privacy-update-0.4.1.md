# HN Summary 0.4.1 — store privacy update

_Prepared 2026-11-01 from the 0.4.1 code. For the team that updates the Chrome
Web Store listing._

The live listing says that the developer "will not collect or use your data".
This is not correct for 0.4.1. Google counts data that the extension uses only
on the device:

> "Extensions are required to disclose how they handle user data, even when
> data is processed or stored locally on a user's device and is not transmitted
> to external servers or third parties."
> ([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), question 3)

Select three data types: **Website content**, **Web history** and
**Authentication information**. Then paste the new permission text, the privacy
policy URL and the new description.

The exact text to paste is in two files. Do not copy it from other places:

| Dashboard tab | File | Section |
|---------------|------|---------|
| Privacy practices | [listing.md](listing.md) | Single purpose, storage justification, Host permission justification, remote code, Privacy policy, Data collection disclosures |
| Store listing | [description.md](description.md) | "2. Store listing tab" → Description |

---

## 1. Data usage: what to select

| Data type | Select | Reason in the 0.4.1 code |
|-----------|--------|--------------------------|
| **Website content** | **Yes** | The extension reads the text of the linked page (or of the Hacker News discussion, for text posts). The on-device engine (the default) keeps the text on the device. If the user selects OpenRouter, the page title and text go to OpenRouter. |
| **Web history** | **Yes** | Each summary is cached with the link address and the page title in the `localStorage` of news.ycombinator.com. This is a list of the pages that the user asked for. It stays on the device. Google's FAQ includes "the domains or URLs the browser interacts with" in web browsing activity. |
| **Authentication information** | **Yes** | The OpenRouter API key (pasted, or received from "Connect OpenRouter"). Kept in `chrome.storage.local`. Sent only to OpenRouter, in the `Authorization` header. The one-time "Connect OpenRouter" secret goes only to OpenRouter. |
| Personally identifiable information | No | No name, email address or account ID is read. |
| Health information | No | Not used. |
| Financial and payment information | No | Not used. The user pays OpenRouter directly. |
| Personal communications | No | Not used. |
| Location | No | Not read. The linked website sees the IP address, as with any visit. |
| User activity | No | The extension reacts only to clicks on its own buttons. It does not record clicks, keys, scrolls or network traffic. |

**Why Web history.** The first review did not include it, but it asked us to
check the URL handling. The code keeps a list of summarized links with page
titles. If you disclose too much, nothing goes wrong. If you disclose too
little, you break the policy. The privacy policy and the description now say
the same thing.

**Certifications: keep all three.** The 0.4.1 code agrees with each one.

- Not sold to third parties, outside of the approved use cases. The only third
  party is OpenRouter. The user selects it, and it gets data only to make the
  summary that the user asked for.
- Not used or transferred for purposes unrelated to the single purpose.
- Not used or transferred to determine creditworthiness or for lending purposes.

---

## 2. What we checked in the code

- The link address goes only to the linked website, as a normal page request
  without cookies (`src/background.js`). OpenRouter gets the page title and
  text, not the address (`src/content.js`, `summarizeWithOpenRouter`).
- No analytics, no tracking and no server. The only network hosts are the
  linked website and `openrouter.ai` (model list, key exchange, summaries).
- The content script runs only on news.ycombinator.com. It does not read the
  user's history, tabs or other pages. `manifest.json` has no `tabs` or
  `history` permission.
- The on-device engine uses Chrome's built-in Summarizer API. The extension
  ships no model and runs no remote code.
- **Error fixed in our draft text:** the storage justification said that
  summaries are cached in `chrome.storage.local`. They are in the
  `localStorage` of news.ycombinator.com.
- **Error fixed in the description:** it said "It does not read or change the
  pages that you visit". The extension changes Hacker News pages (it adds
  buttons and summaries). The new text says this.

---

## 3. Store description: what changed

Two parts of the description in [description.md](description.md) changed:

- **WHY IT ASKS TO READ ALL SITES.** It now says that the extension changes
  only the Hacker News pages, and does not read or change the other pages.
- **PRIVACY.** It now says: no analytics or tracking; with on-device summaries
  (the default), the article text stays on the computer; OpenRouter is
  optional; settings, the key and past summaries stay on the computer. The
  privacy policy line has the real URL.

---

## 4. Privacy policy: what changed

The store links to
https://github.com/gianluca-venturini/digestivo/blob/main/PRIVACY.md. It must
agree with the disclosures. The changes in [PRIVACY.md](../PRIVACY.md):

- New summary table with the same three data types as the store form.
- The cache entry: it has the link address, the page title, the summary and
  the model name.
- The one-time "Connect OpenRouter" secret is now in the list of stored data.
- OpenRouter receives the page title and text, not the link address. The three
  app headers are named.
- Uninstall does not remove cached summaries. The policy tells the user how to
  remove them.
- Last updated line: 2026-11-01, version 0.4.1.

The on-device and "Connect OpenRouter" sections were already correct.

---

## 5. Steps

1. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   and the HN Summary item.
2. **Privacy practices** tab: paste the fields from [listing.md](listing.md).
   Select the three data types in section 1. Keep the three certifications.
3. **Store listing** tab: paste the description from
   [description.md](description.md).
4. **Package** tab: upload `dist/hn-summary-v0.4.1.zip` (run `./build.sh` if
   it is not there). The live listing is 0.1.4. The new text is not correct
   for 0.1.4.
5. Submit for review. After it goes live, open the public listing and make sure
   the "Privacy practices" box shows the three data types.

---

## Sources

- [Chrome Web Store User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq):
  local data must be disclosed; definition of web browsing activity.
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy):
  disclosures must agree with the privacy policy.
- [Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use):
  use data only for the disclosed single purpose.
