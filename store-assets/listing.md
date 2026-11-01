# Chrome Web Store listing — privacy fields

Paste each field into the corresponding box in the Developer Dashboard.
Store descriptions are plain text (no Markdown rendering), so paste the text as-is.

For the 0.4.1 privacy update (what to select, why, and the steps), see
[privacy-update-0.4.1.md](privacy-update-0.4.1.md).

---

## Store listing tab

The name, summary, description, category, screenshots and promo tiles are in
[description.md](description.md).

---

# Privacy practices tab — exact form fields

## Single purpose

```
Summarize the article linked from a Hacker News story, and show the summary inline on the Hacker News page.
```

## storage justification
_(max 1,000 characters)_

```
The extension uses chrome.storage.local to keep these settings on the user's device: (1) the summary engine the user selected (on-device or OpenRouter); (2) if the user selects OpenRouter, the OpenRouter API key, the model, how the key was added (pasted or "Connect OpenRouter") and the date of the connection; (3) during "Connect OpenRouter" only, a one-time random secret, which is deleted when the connection completes. Without these values, the extension cannot use the engine that the user selected, and the user must enter the key again each time. chrome.storage.local itself sends nothing to a server. The key is sent only to OpenRouter, to authenticate the summary requests that the user starts. Summaries are cached separately, in the localStorage of news.ycombinator.com, not with this permission.
```

## Host permission justification
_(max 1,000 characters — one field covering every match pattern in "permissions" and "content_scripts")_

```
The content script runs only on https://news.ycombinator.com/*. It adds the (+) and (++) buttons and shows summaries under the stories. It also completes "Connect OpenRouter", because OpenRouter returns the user to that page.
http://*/* and https://*/* are necessary because a story can link to any website. When the user clicks (+) or (++), the background script downloads only that one linked page, without cookies, so that the extension can read the article text. A content script cannot read other websites. No page is downloaded until the user clicks a button. Local network addresses are refused.
The same patterns cover https://openrouter.ai/*, which is used only if the user selects OpenRouter: to get the public model list, to get the key during "Connect OpenRouter", and to make summaries. By default, Chrome's built-in Summarizer API makes the summary on the device, and the article text is not sent to a server.
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

- Does this extension collect user data? **Yes.** Google defines "collect" to
  include data that is used or stored only on the device:
  "Extensions are required to disclose how they handle user data, even when data
  is processed or stored locally on a user's device and is not transmitted to
  external servers or third parties."
  ([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), question 3)
- Privacy policy URL. Use the public URL of `PRIVACY.md` on the `main` branch:

```
https://github.com/gianluca-venturini/digestivo/blob/main/PRIVACY.md
```

## Data collection disclosures
_(Data usage section of the same tab. Select only these types.)_

| Type | Select | Why (checked in the 0.4.1 code) |
|------|--------|-------------------------------|
| Personally identifiable information | No | The extension does not read a name, email address or account ID. |
| Health information | No | Not used. |
| Financial and payment information | No | Not used. The user pays OpenRouter directly. |
| **Authentication information** | **Yes** | The OpenRouter API key, pasted or received from "Connect OpenRouter". Kept in `chrome.storage.local`. Sent only to OpenRouter in the `Authorization` header. The one-time "Connect OpenRouter" secret is sent only to OpenRouter. |
| Personal communications | No | Not used. |
| Location | No | Not read. (The linked website sees the IP address, as with any visit.) |
| **Web history** | **Yes** | The extension downloads the page at each link that the user summarizes, and caches the summary with the link address and the page title in the `localStorage` of news.ycombinator.com. This is a list of pages that the user asked for. It stays on the device. Google's FAQ calls this "web browsing activity": "any information about the websites or other web resources a user requests or interacts with, including the domains or URLs". |
| User activity | No | The extension reacts only to clicks on its own buttons. It does not record clicks, keys, scrolls or network traffic. |
| **Website content** | **Yes** | The text of the linked page (or of the Hacker News discussion, for text posts). Summarized on the device by default. Sent to OpenRouter only if the user selects OpenRouter. |

Not sent anywhere: the link address is sent only to the linked website itself
(a normal page request). OpenRouter receives the page title and text, not the
address.

Certify all three statements (the 0.4.1 code agrees with each one):

- I do not sell or transfer user data to third parties, outside of the approved
  use cases. (The only third party is OpenRouter, which the user selects, and
  it gets data only to make the summary that the user asked for.)
- I do not use or transfer user data for purposes that are unrelated to my
  item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for
  lending purposes.
