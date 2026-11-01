# HN Summary — Chrome Web Store listing

This file has the text and images for each part of the store listing:
https://chromewebstore.google.com/detail/hn-summary/mhidflapanlggcfmgfmlkbojpimodhif

Copy each text block into the field with the same name in the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole).
The store shows plain text only. Do not use Markdown in the fields.
The text for the **Privacy practices** tab is in [listing.md](listing.md).
For the 0.4.1 privacy update, see [privacy-update-0.4.1.md](privacy-update-0.4.1.md).

---

## 1. Marketing plan (short)

We compared three possible hooks with a second agent:
"free and private on-device AI", "decide what to read", and "use any model".

- **Main promise:** know what a link says before you click it.
  People find the listing when they search for "hacker news". They want a
  better Hacker News, not "on-device AI".
- **Proof of the promise:** free, private, no key, no account, no server.
- **Last:** OpenRouter. It is the path for computers that cannot run
  Gemini Nano, and for users who want a better model.
- **Be honest about the limits.** Gemini Nano needs a strong desktop computer.
  The description says this near the top, and gives OpenRouter as the
  alternative. If we hide it, users install, fail, and give 1 star.
- **Explain the "all websites" warning** before the user sees it.
- **Trademarks.** Use "Hacker News" only to say where the extension works.
  Do not use the Y Combinator "Y" logo as our logo. (The popup header showed an
  orange "Y" box. It now shows the extension icon.) Do not put "Gemini" or
  "OpenRouter" on the promo tiles. End the description with a
  "not affiliated" line.

Screenshot order follows the user's path: see the value (1, 2), see that it is
free and private (3), see the path for other computers (4, 5).

---

## 2. Store listing tab

### Item name

```
HN Summary
```

### Summary (132 characters maximum)

The store takes this text from `"description"` in `manifest.json`.
It shows in search results and on the listing card.

```
See what a Hacker News link says before you click. Short or long summaries, free and private on your computer.
```

(110 characters. Also used as `"description"` in `manifest.json`.)

### Description

The first two lines show before "more". They must give the promise and the
proof.

```
See what a Hacker News link says before you open it. HN Summary adds (+) and (++) next to each story. Click one, and a summary opens under the story.

Summaries are free and private on most new computers with Chrome. You do not need an account, a key, or a server.

HOW TO USE
1. Install HN Summary. A welcome page opens.
2. Click "Download now" one time. Chrome gets its on-device AI model.
   Or, if your computer cannot run it: select OpenRouter and click "Connect OpenRouter". Log in and allow access.
3. Open Hacker News and click (+) or (++) next to a story.

WHAT YOU GET
• (+) gives a short summary of 2 or 3 sentences.
• (++) gives one sentence of overview, then the main points as a list.
• The summary opens under the story. You stay on the page.
• Click (-) or (--) to close the summary.
• For "Ask HN" and other text posts, you get a summary of the discussion.
• Each summary is kept on your computer. When you open it again, it shows immediately.

WHY IT ASKS TO READ ALL SITES
When you install it, Chrome says that the extension can "read and change all your data on all websites". The extension needs this because a story can link to any website. It uses this permission only when you click (+) or (++). Then it downloads that one page, without your cookies. It changes only the Hacker News pages, to add the buttons and the summaries. It does not read or change the other pages that you visit. It does not open links to local network addresses.

WHAT YOU NEED
For the free on-device AI: Chrome 138 or newer on Windows 10 or 11, macOS 13 or newer, Linux, or a Chromebook Plus. You also need 22 GB of free disk space, and a GPU with more than 4 GB of memory (or 16 GB of RAM and 4 CPU cores). It does not work on phones.
If your computer cannot do this, use OpenRouter.

OPENROUTER (OPTIONAL)
OpenRouter gives you many AI models. The summaries are often better. You pay OpenRouter for what you use.
• Click "Connect OpenRouter", log in, and allow access. You do not copy a key. The extension gets its own key, named "HN Summary". You can see or delete it at https://openrouter.ai/settings/keys
• Or paste a key from https://openrouter.ai/keys
• Then select a model from the list.

PRIVACY
• No analytics or tracking. No server. We do not sell data.
• With on-device summaries (the default), the article text stays on your computer.
• OpenRouter is optional. If you select it, the article text and your OpenRouter key go only to OpenRouter.
• The extension keeps your settings, your OpenRouter key and your past summaries on your computer only.
• The source code is public: https://github.com/gianluca-venturini/digestivo
• Privacy policy: https://github.com/gianluca-venturini/digestivo/blob/main/PRIVACY.md

HN Summary is not affiliated with Y Combinator or Hacker News. Gemini is a trademark of Google LLC. Other names are trademarks of their owners.
```

### Category

```
Productivity > Tools
```

The live listing uses "Education". Similar extensions for Hacker News use
"Tools". "Lifestyle > News & Weather" is also possible.

### Language

```
English (United States)
```

---

## 3. Graphic assets

### Store icon (128×128)

`icons/128.png`. Google asks for 96×96 artwork with 16 px of transparent space
on each side. The current icon fills all 128×128 pixels. See section 5.

### Screenshots (1280×800, upload in this order)

The store shows screenshots at 640×400. All text in these images can be read
at that size. The images are PNG without an alpha channel, with square corners.

| # | File | Headline | Sub-caption | What it shows |
|---|------|----------|-------------|---------------|
| 1 | [screenshot-1-summary-on-hn.png](screenshot-1-summary-on-hn.png) | Know what a link says before you click | Click (+) next to any story. The summary opens under it. | Hacker News with (+) and (++) on each story, and a short summary open under one story ("via Gemini Nano (on device)"). |
| 2 | [screenshot-2-long-summary.png](screenshot-2-long-summary.png) | Short or long. Your choice. | Click (++) for a longer summary in bullet points. | A (++) summary: one line of overview, then a list ("via anthropic/claude-sonnet-5.5"). |
| 3 | [screenshot-3-on-device.png](screenshot-3-on-device.png) | Free. Private. On your computer. | Chrome's built-in AI. No key. The text stays on your device. | Popup: On-device (Gemini Nano) selected, "Ready on this device." |
| 4 | [screenshot-4-connect-openrouter.png](screenshot-4-connect-openrouter.png) | Or connect OpenRouter in one click | Log in and allow access. No key to copy. | Popup: OpenRouter selected, the "Connect OpenRouter" button. |
| 5 | [screenshot-5-paste-key.png](screenshot-5-paste-key.png) | Already have a key? Paste it. | Pick any OpenRouter model. Your key stays in this browser. | Popup: a pasted key (hidden), a model, and Save. |

### Small promo tile (440×280)

[promo-small-440x280.png](promo-small-440x280.png): the icon, "HN Summary",
"Know before you click", and the (+) and (++) buttons on a full orange
background. Google says to use strong colors and not much text, and that the
tile must work at half size. It does not show the Hacker News name or the "Y" logo.

### Marquee promo tile (1400×560)

[promo-marquee-1400x560.png](promo-marquee-1400x560.png): the same design,
larger. The store uses it only if Google selects the extension for the home
page carousel.

### Video

None. A short YouTube video (under 2 minutes) of a click on (+) is a good
next step.

---

## 4. Other fields

| Field | Value |
|-------|-------|
| Homepage URL | https://github.com/gianluca-venturini/digestivo |
| Support URL | https://github.com/gianluca-venturini/digestivo/issues |
| Privacy policy URL | https://github.com/gianluca-venturini/digestivo/blob/main/PRIVACY.md ([PRIVACY.md](../PRIVACY.md)) |

---

## 5. Recommendations (not done in this change)

1. **Ask for "all sites" access on the first click, not at install.** Move
   `http://*/*` and `https://*/*` to `optional_host_permissions`. Then Chrome
   does not show "Read and change all your data on all websites" at install.
   This change is in the product, not in the listing.
2. **Store icon padding.** Make the 128×128 icon with 96×96 artwork and 16 px
   of transparent space on each side, as Google asks.
3. **Publish 0.4.1 soon.** The live listing is version 0.1.4. It still says
   that you need Jina and OpenRouter keys. The new text and images are not
   correct for that version.
4. **Ask for a "Featured" badge** after the release. Google wants the main
   features to work without extra accounts or payments. The on-device engine
   does this.

---

## 6. How the images were made

Run `store-assets/source/make.sh`. It loads the extension in headless
Chromium with Playwright, and it uses a saved copy of the Hacker News front
page (`hn-snapshot.html`, 1 November 2026). Then it captures the real page and
popup, and adds the headlines and callouts.

- **Summaries.** The two summaries on the Hacker News page are in
  `summaries.json`. They are written from the real articles, in the format that
  the extension makes. The script puts them in the extension's summary cache, so
  the real extension shows them.
- **Gemini Nano.** Headless Chromium does not have Gemini Nano. For the
  screenshot only, a copy of the popup gets a stub (`mock-nano.js`) that
  reports "available". The extension code does not change.
- **Captions.** Edit `slides.json`, then run `make.sh` again.
