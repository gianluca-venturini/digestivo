# Plan: on-device summaries by default, OpenRouter optional

Version target: **0.3.0**. Status: implemented (2026-10-31). Tested with a fake
`Summarizer` in Playwright Chromium. Not yet tested with the real Gemini Nano
model (Section 3).

## 1. Goal

- The extension works with **zero keys** after install.
- The default summary engine is Chrome's built-in **Summarizer API**
  (Gemini Nano, on the device, stable since Chrome 138).
- OpenRouter stays as an optional engine with better quality.
- The settings popup has a toggle: **On-device (Gemini Nano)** or **OpenRouter**.
  The OpenRouter key and model fields show only when OpenRouter is selected.
- Target: install the extension, open Hacker News, click `(+)`, and see a
  summary in less than 5 seconds (when Chrome already has the model, see 9.1).

Out of scope:

- Automatic change to OpenRouter when Gemini Nano is not available. The user selects the engine.
- PDF summaries, and other built-in APIs (Prompt API, Translator API).

## 2. Design

```
Click (+)  (user gesture)
  |
  |-- engine = nano ---------------------------------------------.
  |     start Summarizer.create() NOW (needs the gesture if the    |
  |     model is not downloaded yet), do not wait                  |
  |                                                                |
  |-- askBackground 'hnsum:fetch'  -> HTML   (no change)           |
  |-- extract() with Defuddle      -> text   (no change)           |
  |                                                                |
  |-- engine = openrouter: summarizeWithOpenRouter() (no change)   |
  '-- engine = nano:     await the summarizer  <-------------------'
                         fit text to inputQuota
                         summarizeStreaming() -> show text while it arrives
-> panel + localStorage cache (no change)
```

Decisions:

| Decision | Choice | Reason |
|---|---|---|
| Default engine | `nano` for new installs | No key, no account, no cost. The article text stays on the device. |
| Engine for current users | `openrouter` if a key and a model are already saved | Their summaries must not change after the update. |
| Where Nano runs | Content script on the HN page | The page is a top-level HTTPS window, which the API needs. The API is not in workers, so the background script cannot use it. The click is the user gesture that `create()` needs. Section 3 checks this. |
| Fallback location | An extension page in a hidden `<iframe allow="summarizer">` | Use it only if Section 3 shows that the content script cannot see `Summarizer`. |
| `(+)` short | `type: 'tldr'`, `length: 'medium'` | 3 sentences at most. Same as the OpenRouter prompt (2–3 sentences). |
| `(++)` long | `type: 'key-points'`, `length: 'long'` | 7 bullets at most. Near the OpenRouter prompt (overview + 4–7 bullets). One call only, for speed. |
| Format | `format: 'markdown'` | `hnsumRenderMarkdown` already shows `-` and `*` bullets. |
| Output | `summarizeStreaming()` | The first words show in about one second. This helps the 5-second goal more than total time. |
| Language | `expectedInputLanguages: ['en','es','ja','de','fr']`, `outputLanguage: 'en'` | These are the supported languages. Without `outputLanguage`, Chrome writes a console warning. |
| Summarizer objects | One per mode, kept for the page life | `create()` is slow the first time. Options cannot change after `create()`. |
| Input too long | Measure with `measureInputUsage()`, cut the text, measure again | The input limit of Nano is much smaller than our `MAX_CHARS` (24,000). |
| Minimum Chrome | Keep `121` | OpenRouter must still work on old Chrome, Orion, and Firefox. Nano is found with `'Summarizer' in self`. |

## 3. Step 0: test in Chrome before the main work

Make a small test build. Load it in Chrome 138+ on macOS. Record the results
in this section.

| # | Check | Expected |
|---|---|---|
| 1 | `'Summarizer' in self` in the content script | `true` |
| 2 | `await Summarizer.availability()` in the content script | `available`, `downloadable`, or `downloading` |
| 3 | `Summarizer.create()` from a `(+)` click, model not downloaded | Download starts. `downloadprogress` events arrive. |
| 4 | `Summarizer.create()` after a 3 s `await` in the click handler | Find out if the gesture is still valid (Chrome gives about 5 s). |
| 5 | `summarizer.inputQuota` for `tldr` and `key-points` | Record the number. |
| 6 | `summarizeStreaming()` chunks | Each chunk is new text only (MDN joins the chunks). Confirm. |
| 7 | Time to first text and total time, 3,000-word article | Record both. Goal: first text < 2 s, total < 5 s. |
| 8 | Same checks in an incognito window | Record the result. |
| 9 | `chrome://on-device-internals` | Record the model size and the model variant. |

Result rules:

- If check 1 is `false`: use the iframe fallback (Section 5.3 b).
- If check 4 fails: call `create()` before every `await` in the click path (Section 5.3 already does this).
- If check 7 total time is much more than 5 s: change `(+)` to `length: 'short'` (1 sentence) and measure again.

## 4. Settings

### 4.1 `src/lib/settings.js`

```js
export const KEYS = ['engine', 'openrouterKey', 'model'];
export const DEFAULTS = { engine: '', openrouterKey: '', model: '' };

// Current users with a saved key keep OpenRouter. New users get Nano.
export function resolveEngine(s) {
  if (s.engine === 'nano' || s.engine === 'openrouter') return s.engine;
  return s.openrouterKey && s.model ? 'openrouter' : 'nano';
}

export function isConfigured(s) {
  return resolveEngine(s) === 'nano' || Boolean(s.openrouterKey && s.model);
}
```

- The content script cannot `import` (it is a classic script). Copy the same
  `resolveEngine` rule into `content.js` and add a comment that links the two.
- Do not write `engine` to storage at install. Write it only when the user
  changes the toggle. Then the "current users" rule works for every update.
- Keep the OpenRouter key when the user selects Nano. The user can change back
  without typing the key again.

### 4.2 Popup (`src/popup.html`, `src/popup.js`, `src/popup.css`)

```
+--------------------------------------+
| [Y] HN Summary                       |
|                                      |
| Summary engine                       |
| (o) On-device (Gemini Nano)  free    |
| ( ) OpenRouter  better quality       |
|                                      |
| Status: Ready on this device         |   <- Nano selected
|   or: Needs a one-time download      |
|       [Download now]  ████░░░ 42%    |
|   or: Not available in this browser  |
|       or on this device. Use         |
|       OpenRouter.                    |
|                                      |
| -- only when OpenRouter selected --  |
| OpenRouter API key [............]    |
| Model              [............]    |
| [Save]                               |
|                                      |
| note text                            |
+--------------------------------------+
```

- Two radio buttons in a `<fieldset>`, HN style (Verdana, `#ff6600` accent).
- A change of the radio button saves `engine` at once and shows "Saved ✓".
  The Save button saves only the key and the model.
- Put the OpenRouter fields in `<div id="openrouterFields" hidden>`. Show it only when `engine === 'openrouter'`.
- Call `populateModels()` only when OpenRouter is selected. Then the popup makes no network call in Nano mode.
- Nano status: call `Summarizer.availability()` in the popup (an extension page is a top-level window).
  - `available` → "Ready on this device".
  - `downloadable` or `downloading` → "Needs a one-time download" and a **Download now** button.
    The click calls `Summarizer.create({ monitor })` and shows `e.loaded` (0 to 1) as a percent.
    The download continues in Chrome after the popup closes.
  - `unavailable`, or no `Summarizer` global → "Not available in this browser or on this device" and the requirements (Section 9.2). Do not hide the Nano option; the user must see why it does not work.
- Note text for each engine:
  - Nano: "Summaries are made on your device. The article text does not leave your browser. Chrome downloads the model from Google one time."
  - OpenRouter: the current text.

### 4.3 First run (`src/background.js`)

- On `chrome.runtime.onInstalled` with `reason === 'install'`, open
  `src/popup.html?welcome=1` in a new tab. The page shows a short welcome line
  and the same **Download now** button.
- Reason: the model download needs a user click. If the user clicks on the
  welcome page, the model is often ready before the first visit to Hacker News.
- If `onInstalled` does not fire (Orion), nothing breaks. The first `(+)` click starts the download.
- In `popup.js`, read `welcome=1` from `location.search`. In a tab, set the page width to 480 px.

## 5. Content script (`src/content.js`)

### 5.1 Settings and button state

- `loadSettings()` reads `engine`, `openrouterKey`, `model`, then sets `settings.engine = resolveEngine(...)`.
- For Nano, also call `Summarizer.availability()` one time and keep the result in `nanoState`.
- `configured` rules:

| Engine | State | Buttons | Tooltip |
|---|---|---|---|
| `nano` | `available` | on | "Short summary" / "Long summary" |
| `nano` | `downloadable`, `downloading` | on | "Short summary (first click downloads the on-device model)" |
| `nano` | `unavailable` or no `Summarizer` | grey | "On-device AI is not available here. Choose OpenRouter in the extension settings." |
| `openrouter` | key and model set | on | as today |
| `openrouter` | missing | grey | as today (`DISABLED_TITLE`) |

- Add `changes.engine` to the `storage.onChanged` filter.

### 5.2 Engine split

- Rename `summarizeText()` to `summarizeWithOpenRouter()`. No other change.
- Add `summarizeWithNano(mode, title, content, summarizerPromise, onText)`.
- `doSummarize` selects the engine. The result `model` field is
  `settings.model` for OpenRouter and `'Gemini Nano (on device)'` for Nano.
  The footer shows "via Gemini Nano (on device)".

### 5.3 Nano call

a) Create the summarizer at the start of the click path:

```js
const NANO_OPTIONS = {
  short: { type: 'tldr', length: 'medium' },
  long: { type: 'key-points', length: 'long' },
};
const nanoSummarizers = {}; // mode -> Promise<Summarizer>

function getNanoSummarizer(mode, onProgress) {
  if (!nanoSummarizers[mode]) {
    nanoSummarizers[mode] = Summarizer.create({
      ...NANO_OPTIONS[mode],
      format: 'markdown',
      sharedContext: 'An article linked from Hacker News. The reader is a software engineer.',
      expectedInputLanguages: ['en', 'es', 'ja', 'de', 'fr'],
      outputLanguage: 'en',
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => onProgress(e.loaded));
      },
    }).catch((e) => {
      delete nanoSummarizers[mode]; // let the next click try again
      throw { stage: 'summarize', name: 'NanoCreate', raw: String(e) };
    });
  }
  return nanoSummarizers[mode];
}
```

- In `doSummarize`, call `getNanoSummarizer()` **before** `await fetchReadable()`.
  The fetch can take more than 5 s, and then the click gesture is no longer valid.
  The download and the page fetch then also run at the same time.
- `onProgress` shows "downloading on-device model… 42%" in the panel. When
  `loaded === 1`, show "loading model…" until `create()` resolves.

b) Fallback, only if Section 3 check 1 fails: add `src/nano-frame.html` and
`src/nano-frame.js` to `web_accessible_resources` for `https://news.ycombinator.com/*`.
The content script adds a hidden `<iframe allow="summarizer">` with this page and
talks to it with `postMessage`. The click gesture is not shared with the frame,
so the download must start from the popup or the welcome page.

c) Fit the text to the input limit:

```js
async function fitToQuota(summarizer, text, context) {
  let t = text;
  for (let i = 0; i < 4; i++) {
    const used = await summarizer.measureInputUsage(t, { context });
    if (used <= summarizer.inputQuota) return t;
    t = t.slice(0, Math.floor(t.length * (summarizer.inputQuota / used) * 0.9));
  }
  return t;
}
```

- Give the title as `context: \`Title: ${title}\``. Do not put it in the text.
- If `measureInputUsage` is missing, cut to 12,000 characters.
- If `summarize` still throws `QuotaExceededError`, cut the text by half one time and try again.

d) Stream the result:

```js
let out = '';
for await (const chunk of summarizer.summarizeStreaming(text, { context })) {
  out += chunk;
  onText(out); // render at most one time per animation frame
}
```

- `onText` calls the existing `renderSummary` with a partial result and no footer.
  The refresh link and footer show when the stream ends.
- Write the cache only when the stream ends without an error.
- If the text is empty at the end, use the existing `EmptyContent` error.

### 5.4 New error messages

| name | Message |
|---|---|
| `NanoUnavailable` | On-device AI is not available here. Choose OpenRouter in the extension settings. |
| `NanoNeedsClick` (`NotAllowedError` from `create()`) | Click the button again to download the on-device model. |
| `NanoCreate` (other) | Could not start on-device AI. Try again, or choose OpenRouter. |
| `NanoLanguage` (`NotSupportedError`) | On-device AI does not support this language. Choose OpenRouter in settings. |
| `NanoFailed` (`summarize` error) | On-device AI could not summarize this page. |

Keep all fetch, extract, and OpenRouter messages.

## 6. Manifest

- `"version": "0.3.0"`.
- `"description"`: "Add + / ++ buttons to Hacker News that summarize the linked article on your device, or with OpenRouter."
- No new permission. `Summarizer` needs no manifest permission.
- Only for fallback 5.3 b: add `web_accessible_resources`.

## 7. Documents

- `README.md`: Setup step 4 becomes optional ("To use OpenRouter, …"). Add Nano to "How it works". Add the device requirements (Section 9.2).
- `PRIVACY.md`: Nano mode sends the article text to no one. Chrome downloads the model from Google one time, and Chrome controls that download. OpenRouter mode is as today. Set a new date.
- `store-assets/listing.md`: The short description no longer says "using your own OpenRouter key". New "WHAT YOU NEED" text: nothing in Chrome 138+ on desktop, or an OpenRouter key for other browsers and for better quality.
- `plans/2026-07-11-hn-summary.md`: Add a "Revision (v0.3.0)" note that links to this file, like the v0.2.0 note.
- Store screenshots: add one of the popup with the engine toggle.

## 8. Test plan

Desktop Chrome 138+ (load unpacked). Clear `hnsum:*` in `localStorage` before each run.

| Case | Expected |
|---|---|
| New install, model already in Chrome | Welcome tab opens. On HN, `(+)` shows first text in < 2 s and the full summary in < 5 s. |
| New install, no model | Welcome tab → Download now → percent rises. Close the tab: the download continues. |
| No model, no welcome click, `(+)` on HN | Panel shows the download percent, then the summary. |
| `(++)` | 7 bullets or fewer, rendered as a list. |
| Long article (Wikipedia, 10,000 words) | Summary. No `QuotaExceededError`. |
| Japanese page (aozora.gr.jp) | English summary. |
| Unsupported language (for example Korean) | Summary or `NanoLanguage` message. Record which. |
| Toggle to OpenRouter | Key and model fields show. Model list loads. Summaries say "via <model>". |
| Toggle back to Nano | Fields hide. Key is still stored. No request to openrouter.ai from the popup. |
| Update from 0.2.0 with a key saved | Engine is OpenRouter. Nothing changes for the user. |
| Update from 0.2.0 without a key | Engine is Nano. Buttons are on. |
| Nano mode, network check | No request to openrouter.ai. Only the article fetch. |
| Chrome < 138, or Orion iOS, Nano mode | Buttons grey, tooltip says to choose OpenRouter. Popup says "Not available". |
| Refresh `↻` | New fetch and new Nano summary. |
| Error during stream (disable the model in `chrome://on-device-internals`) | Red button, alert, nothing cached. |

### Results with a fake Summarizer (Playwright Chromium 156, 2026-10-31)

A test copy of the extension added a fake `Summarizer` before `content.js` and
`popup.js`. The fake sends download progress (0, 50, 100 %), needs a user
gesture for `create()` when the model is not downloaded, and streams words.
The article fetch used the real sites. OpenRouter was replaced by a mock.
29 of 29 checks passed:

| Area | Result |
|---|---|
| Install | Welcome tab opens. Nano is selected. Download now shows the percent, then "Ready on this device." |
| `(+)`, model not downloaded | Button tooltip has the download hint. Panel shows "downloading … 0%", "50%", "loading …", then streamed text, then the footer "via Gemini Nano (on device)". About 1.9 s with the fake. |
| `create()` | Called with a valid user gesture, `tldr` / `medium` / `markdown` / `en`. |
| Long text | Cut to fit the fake quota (1,000 units). The title went in `context`. |
| `(++)` | `key-points` / `long`. Shown as a list. |
| Cache | Reopen shows the cached summary with no new call. |
| Unavailable | Buttons grey, tooltip says to choose OpenRouter. Popup says "Not available" and hides Download now. |
| No `Summarizer` (plain Chromium) | Same as unavailable. Popup makes no request to OpenRouter in Nano mode. |
| Toggle | OpenRouter shows the key and model fields and loads the model list. Toggle back keeps the key. |
| Update from 0.2.0 | With a key and model: OpenRouter. Without: Nano. |

Not tested: the `QuotaExceededError` retry, and the real model.

Real Chrome 156 on this Mac, new empty profile started by Playwright:
`Summarizer.availability()` returned `unavailable` for 30 s. Playwright turns
off some Chrome features, so this result does not show if the device can run
Nano. Check in a normal Chrome profile.

## 9. Known limits

### 9.1 The 5-second goal

- The goal holds only when Chrome already has Gemini Nano, or after the download.
- The first download is large (size in Section 3, check 9) and can take minutes. The welcome tab starts it early, but it cannot make it faster.
- Chrome deletes the model when free disk space falls below about 10 GB. Chrome does not download it again by itself. The next `create()` starts the download again.

### 9.2 Who cannot use Nano

- Chrome for Android, iOS, and ChromeOS devices that are not Chromebook Plus.
- Orion, Firefox, Safari: no `Summarizer`. These users must use OpenRouter.
- Devices without 22 GB of free disk space, or without a GPU with more than 4 GB of VRAM (or 16 GB of RAM and 4 CPU cores).
- Metered networks: Chrome does not start the download.
- Companies that turn off on-device AI with a Chrome policy.

### 9.3 Quality

- Gemini Nano is a small model. Summaries are shorter and less exact than a large OpenRouter model. The popup labels OpenRouter "better quality".
- The input limit is small. For long articles Nano sees only the start of the text. A later version can summarize parts and then summarize the summaries.

## 10. Order of work

1. To do: Step 0 tests with the real model (Section 3). Record the results here.
2. Done: `settings.js` + popup toggle + Nano status + download button.
3. Done: `content.js`: engine split, `getNanoSummarizer`, `fitToQuota`, streaming render, errors.
4. Done: Welcome tab in `background.js`.
5. Done: Manifest version and description, documents.
6. Done with a fake `Summarizer` (results in Section 8). To do: with the real model.
7. Done: `./build.sh`. To do: upload `dist/hn-summary-v0.3.0.zip`.

## 11. Sources

Pages read on 2026-10-31. Their "last updated" dates are 2025, so check the numbers again in Step 0.

- Summarizer API (types, lengths, streaming, languages, Chrome 138): https://developer.chrome.com/docs/ai/summarizer-api
- Get started (hardware, OS, user gesture, `availability()` values): https://developer.chrome.com/docs/ai/get-started
- Built-in AI in extensions: https://developer.chrome.com/docs/extensions/ai
- Built-in API status: https://developer.chrome.com/docs/ai/built-in-apis
- Show download progress to users: https://developer.chrome.com/docs/ai/inform-users-of-model-download
- Model management (deletion at low disk space, no automatic new download): https://developer.chrome.com/docs/ai/understand-built-in-model-management
- Long text (`inputQuota`, `measureInputUsage`): https://developer.chrome.com/docs/ai/scale-summarization
- Debugging (`chrome://on-device-internals`): https://developer.chrome.com/docs/ai/debug-built-in-model
- MDN, `inputQuota`: https://developer.mozilla.org/docs/Web/API/Summarizer/inputQuota
- MDN, `measureInputUsage()` and `QuotaExceededError`: https://developer.mozilla.org/en-US/docs/Web/API/Summarizer/measureInputUsage
- MDN, using the Summarizer API (streaming chunks): https://developer.mozilla.org/en-US/docs/Web/API/Summarizer_API/Using
