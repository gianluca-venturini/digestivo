# HN Summary

Adds `(+)` (short) and `(++)` (long) buttons to Hacker News that summarize the linked article.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Click the extension's toolbar icon and paste your **Jina Reader** key, **OpenRouter** key, and pick a **model**, then **Save**.
5. Open [news.ycombinator.com](https://news.ycombinator.com/) — `(+)` / `(++)` appear next to each story.

After editing any file, click the **↻ reload** icon on the extension card in `chrome://extensions`, then refresh the HN tab.

## Publish to the Chrome Web Store

### Assets (already generated in this repo)

| Asset | File | Store requirement |
|-------|------|-------------------|
| Upload package | `dist/hn-summary-v0.1.2.zip` (run `./build.sh`) | The extension itself, zipped |
| Store icon | `icons/128.png` | 128×128 PNG (required) |
| Small promo tile | `store-assets/promo-small-440x280.png` | 440×280 (optional but recommended) |
| Marquee promo tile | `store-assets/promo-marquee-1400x560.png` | 1400×560 (optional) |
| Privacy policy | `PRIVACY.md` | Required — host it and paste the URL (see step 5) |

Build (or rebuild) the upload package with the included script — it reads the
version from `manifest.json` and writes `dist/hn-summary-v<version>.zip`:

```bash
./build.sh
```

**You still need to capture screenshots yourself** (at least 1, up to 5, at
**1280×800** or 640×400 PNG). Load the extension (see above), then screenshot
Hacker News with the `(+)`/`(++)` buttons and an expanded summary, and the
settings popup. Screenshots must show the real UI.

### Steps

1. **Register as a developer** (one-time): go to the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   sign in, and pay the one-time **$5** registration fee.
2. **Create item:** click **Add new item** → upload `dist/hn-summary-v0.1.0.zip`.
3. **Store listing:** fill in name, a short + detailed description, category
   (Productivity), language, the **128×128 icon**, your **screenshots**, and the
   **promo tiles** above.
4. **Privacy practices:** state the single purpose ("summarize the linked
   article for a Hacker News story"), and justify each item:
   - `storage` — save the user's API keys, model, and cached summaries locally.
   - host permission `r.jina.ai` — fetch the linked page's text.
   - host permission `openrouter.ai` — generate the summary + list models.
   Disclose data use (API keys are handled; no data sold or used for unrelated
   purposes; not transferred except to Jina/OpenRouter to perform the feature).
5. **Privacy policy URL:** host `PRIVACY.md` somewhere public (e.g. a GitHub repo
   / GitHub Pages / gist) and paste its URL into the required field.
6. **Submit for review.** Review typically takes a few hours to a few days.
   Because the extension requests host permissions, expect the stricter review.

### Updating a published version

Bump `"version"` in `manifest.json`, run `./build.sh`, then in the dashboard open
the item → **Package** → **Upload new package** → submit for review.

