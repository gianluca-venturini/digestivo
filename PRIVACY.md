# Privacy Policy — HN Summary

_Last updated: 2026-11-01 (version 0.4.1)_

HN Summary is a browser extension that summarizes the article linked from a
Hacker News story. It runs entirely in your browser and has no backend server.

## Summary

The extension uses three types of data. It uses them only to make the
summaries that you ask for.

| Data | What it is | Where it goes |
|------|------------|---------------|
| Website content | The text of the page that a story links to | Stays on your device with the on-device engine (the default). Goes to OpenRouter only if you select OpenRouter. |
| Web history | The links that you summarized, with the page title and the summary, kept as a cache | Stays on your device. |
| Authentication information | Your OpenRouter API key, if you use OpenRouter | Stays on your device. Goes only to OpenRouter, with each request. |

No analytics. No tracking. No advertising. No data goes to the developer. We do
not sell data.

## What the extension stores

- **Your summary engine choice** (on-device or OpenRouter), and, if you use
  OpenRouter, **your OpenRouter API key and model choice**, are saved locally
  via `chrome.storage.local` on your device. If you use **Connect OpenRouter**,
  the extension also saves that the key came from this connection, and the date.
  During the connection only, it also saves a one-time random secret (see below).
- **Cached summaries** are saved in your browser's `localStorage` for the
  `news.ycombinator.com` origin, so re-opening a summary doesn't re-run the request.
  Each cached item has the link address, the page title, the summary and the
  name of the model. It is a list of the links that you summarized.

This data never leaves your device except as described below. We do not have a
server and cannot see any of it.

## What is sent, and to whom

The extension sends nothing until you click a summary button. When you click
one, your browser makes the requests below. Which ones depends on the summary
engine you selected in the settings.

1. **The linked website** — your browser downloads the page that the story
   links to (or the Hacker News discussion page for text posts). The request
   has no cookies, so the website does not see who you are logged in as. It
   does see your IP address, as with any visit. Links to local network
   addresses (for example `192.168.x.x` or `localhost`) are refused.
   The extension finds the article text locally, in your browser. No other
   service is used for this step.
2. **On-device engine (the default)** — the summary is made on your device
   by Chrome's built-in model (Gemini Nano). The article text is not sent to
   anyone. Chrome downloads this model from Google one time. Chrome controls
   that download and the model; the extension cannot see or change it.
3. **OpenRouter (`https://openrouter.ai`), only if you select it** — receives
   the page title, the article text and your OpenRouter API key, in order to
   return a summary from the model you selected. It does not receive the link
   address.

The summary request and the Connect OpenRouter key request carry headers that
name the extension (`HTTP-Referer: https://github.com/gianluca-venturini/digestivo`,
and `X-OpenRouter-Title` and `X-Title` with the value `HN Summary`). They
identify the app, not you. OpenRouter uses them to list the app in its public
app rankings.

If you select OpenRouter, the extension also fetches the public model list
from OpenRouter to populate the settings dropdown. Your use of OpenRouter is
governed by its own privacy policy: https://openrouter.ai/privacy

## Connect OpenRouter

When you select OpenRouter and click **Connect OpenRouter** in the popup:

1. The extension makes a random secret and keeps it in `chrome.storage.local`.
   It opens `https://openrouter.ai/auth` in a new tab. The tab URL contains a
   hash of the secret, not the secret.
2. You log in to OpenRouter and allow access. OpenRouter creates a key named
   "HN Summary" in your account.
3. OpenRouter sends the tab to `https://news.ycombinator.com/` with a one-time
   code in the address. Hacker News receives this address like any other page
   visit. The code is useless without the secret, which never leaves your
   browser except in step 4. The extension removes the code from the address.
4. The extension sends the code and the secret to OpenRouter and receives the
   key. It saves the key locally, as for a pasted key, and selects OpenRouter
   as the summary engine.

## What we do NOT do

- No analytics, tracking, telemetry, or advertising.
- No selling or sharing of data.
- No data sent to the developer or to any third party other than OpenRouter,
  as described above.

## Removing your data

Uninstalling the extension removes its stored key and settings. **Disconnect**
in the popup removes the key from the extension. To delete the key from your
OpenRouter account, go to https://openrouter.ai/settings/keys. Uninstalling
does not remove cached summaries, because they are in the site data of
`news.ycombinator.com`. To remove them, clear the site data for
`news.ycombinator.com`.
Version 0.2.0 deletes the Jina Reader key that earlier versions stored.

## Contact

Questions: gianluca.91@gmail.com
