# HN Summary

Adds `(+)` (short) and `(++)` (long) buttons to Hacker News that summarize the linked article.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. A welcome tab opens. Click **Download now** one time. Chrome downloads its
   on-device model (Gemini Nano). No key is necessary.
   Optional: to use **OpenRouter** (better quality, or a browser without the
   on-device model), click the toolbar icon, select **OpenRouter**, then click
   **Connect OpenRouter**. Log in to OpenRouter and allow access. OpenRouter
   sends you back to Hacker News, and the extension saves its new key.
   (Or paste an OpenRouter key, pick a **model**, and **Save**.)
5. Open [news.ycombinator.com](https://news.ycombinator.com/) — `(+)` / `(++)` appear next to each story.

After editing any file, click the **↻ reload** icon on the extension card in `chrome://extensions`, then refresh the HN tab.

Chrome shows the warning `'background.scripts' requires manifest version of 2 or lower.`
This is expected. The manifest declares both `background.scripts` and
`background.service_worker` with the same file: Chrome uses the service worker,
and Orion (iOS) and Firefox use the script. See [plans/2026-10-31-drop-jina.md](plans/2026-10-31-drop-jina.md).

## How it works

1. The background script (`src/background.js`) downloads the linked page, without cookies.
2. The content script extracts the article text locally with
   [Defuddle](https://github.com/kepano/defuddle) (`src/vendor/defuddle.js`).
   Defuddle never uses the network here. See [src/vendor/README.md](src/vendor/README.md).
3. The content script summarizes the text with the engine you selected:
   - **On-device (default):** Chrome's built-in
     [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api)
     (Gemini Nano). The text does not leave your device.
   - **OpenRouter (optional):** the text goes to OpenRouter with your key.

### On-device requirements

The on-device engine needs Chrome 138 or newer on Windows 10/11, macOS 13+,
Linux, or a Chromebook Plus. It needs 22 GB of free disk space, and a GPU with
more than 4 GB of memory (or 16 GB of RAM and 4 CPU cores). It does not work on
Android, iOS (Orion), Firefox, or Safari. There, select OpenRouter.
See [plans/2026-10-31-on-device-summarizer.md](plans/2026-10-31-on-device-summarizer.md).

**Connect OpenRouter** uses OpenRouter's
[sign-in and approve steps](https://openrouter.ai/docs/guides/overview/auth/oauth).
The popup (`src/lib/oauth.js`) opens OpenRouter. The user logs in and allows
access. OpenRouter sends the user back to
`https://news.ycombinator.com/?code=…&state=…`. There, the content script
gives the one-time code to OpenRouter and gets a key. See
[plans/2026-10-31-openrouter-connect.md](plans/2026-10-31-openrouter-connect.md).

## Publish to the Chrome Web Store

### Assets (already generated in this repo)

| Asset | File | Store requirement |
|-------|------|-------------------|
| Upload package | `dist/hn-summary-v0.4.1.zip` (run `./build.sh`) | The extension itself, zipped |
| Store icon | `icons/128.png` | 128×128 PNG (required) |
| Small promo tile | `store-assets/promo-small-440x280.png` | 440×280 (optional but recommended) |
| Marquee promo tile | `store-assets/promo-marquee-1400x560.png` | 1400×560 (optional) |
| Screenshots | `store-assets/screenshot-1-…png` to `screenshot-5-…png` | 1280×800, 1 to 5 |
| Listing text | [`store-assets/description.md`](store-assets/description.md) | Name, summary, description, category |
| Privacy policy | `PRIVACY.md` | Required — host it and paste the URL (see step 5) |

Build (or rebuild) the upload package with the included script — it reads the
version from `manifest.json` and writes `dist/hn-summary-v<version>.zip`:

```bash
./build.sh
```

The screenshots and promo tiles are made from the real extension by
`store-assets/source/make.sh`. Run it again after a change to the UI. See
[`store-assets/description.md`](store-assets/description.md), section 6.

### Steps

1. **Register as a developer** (one-time): go to the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   sign in, and pay the one-time **$5** registration fee.
2. **Create item:** click **Add new item** → upload `dist/hn-summary-v0.4.1.zip`.
3. **Store listing:** copy the name, description, category and language from
   `store-assets/description.md`, and upload the **128×128 icon**, the five
   **screenshots** in order, and the **promo tiles** above.
4. **Privacy practices:** state the single purpose ("summarize the linked
   article for a Hacker News story"), and justify each item:
   - `storage` — save the selected engine, the user's OpenRouter key and model, and cached summaries locally.
   - host permission `http://*/*`, `https://*/*` — download the article the user
     asks to summarize (it can be on any site), and call OpenRouter.
   Disclose data use (the API key is handled; no data sold or used for unrelated
   purposes; not transferred except to OpenRouter to perform the feature, and
   only when the user selects OpenRouter).
   The exact text for each field is in `store-assets/listing.md`.
5. **Privacy policy URL:** host `PRIVACY.md` somewhere public (e.g. a GitHub repo
   / GitHub Pages / gist) and paste its URL into the required field.
6. **Submit for review.** Review typically takes a few hours to a few days.
   The extension requests access to all sites, so expect the in-depth review.
   Users see the warning "Read and change all your data on all websites".

### Updating a published version

Bump `"version"` in `manifest.json`, run `./build.sh`, then in the dashboard open
the item → **Package** → **Upload new package** → submit for review.

