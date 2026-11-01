# Privacy Policy — HN Summary

_Last updated: 2026-10-31_

HN Summary is a browser extension that summarizes the article linked from a
Hacker News story. It runs entirely in your browser and has no backend server.

## What the extension stores

- **Your OpenRouter API key and model choice** are saved locally via
  `chrome.storage.local` on your device.
- **Cached summaries** are saved in your browser's `localStorage` for the
  `news.ycombinator.com` origin, so re-opening a summary doesn't re-run the request.

This data never leaves your device except as described below. We do not have a
server and cannot see any of it.

## What is sent, and to whom

The extension sends nothing until you click a summary button. When you click
one, your browser makes two direct requests:

1. **The linked website** — your browser downloads the page that the story
   links to (or the Hacker News discussion page for text posts). The request
   has no cookies, so the website does not see who you are logged in as. It
   does see your IP address, as with any visit. Links to local network
   addresses (for example `192.168.x.x` or `localhost`) are refused.
   The extension finds the article text locally, in your browser. No other
   service is used for this step.
2. **OpenRouter (`https://openrouter.ai`)** — receives the article text and
   your OpenRouter API key, in order to return a summary from the model you
   selected.

The extension also fetches the public model list from OpenRouter to populate
the settings dropdown. Your use of OpenRouter is governed by its own privacy
policy: https://openrouter.ai/privacy

## What we do NOT do

- No analytics, tracking, telemetry, or advertising.
- No selling or sharing of data.
- No data sent to the developer or to any third party other than OpenRouter,
  as described above.

## Removing your data

Uninstalling the extension removes its stored key and settings. Cached
summaries can be cleared by clearing site data for `news.ycombinator.com`.
Version 0.2.0 deletes the Jina Reader key that earlier versions stored.

## Contact

Questions: gianluca.91@gmail.com
