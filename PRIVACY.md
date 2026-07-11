# Privacy Policy — HN Summary

_Last updated: 2026-07-11_

HN Summary is a browser extension that summarizes the article linked from a
Hacker News story. It runs entirely in your browser and has no backend server.

## What the extension stores

- **Your API keys and model choice** (Jina Reader key, OpenRouter key, selected
  model) are saved locally via `chrome.storage.local` on your device.
- **Cached summaries** are saved in your browser's `localStorage` for the
  `news.ycombinator.com` origin, so re-opening a summary doesn't re-run the request.

This data never leaves your device except as described below. We do not have a
server and cannot see any of it.

## What is sent, and to whom

When you click a summary button, the extension makes two direct requests from
your browser:

1. **Jina Reader (`https://r.jina.ai`)** — receives the URL of the story's link
   (or the Hacker News discussion URL for text posts) and your Jina API key, in
   order to return the page's text.
2. **OpenRouter (`https://openrouter.ai`)** — receives that page text and your
   OpenRouter API key, in order to return a summary from the model you selected.

The extension additionally fetches the public model list from OpenRouter to
populate the settings dropdown. Your use of these services is governed by their
own privacy policies:

- Jina AI: https://jina.ai/legal/
- OpenRouter: https://openrouter.ai/privacy

## What we do NOT do

- No analytics, tracking, telemetry, or advertising.
- No selling or sharing of data.
- No data sent to the developer or any third party other than Jina and
  OpenRouter as described above.

## Removing your data

Uninstalling the extension removes its stored keys and settings. Cached
summaries can be cleared by clearing site data for `news.ycombinator.com`.

## Contact

Questions: gianluca.91@gmail.com
