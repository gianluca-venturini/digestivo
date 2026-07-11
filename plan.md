# HN Summary — Implementation Plan

A Chrome (Manifest V3) extension that adds **`+` (short)** and **`++` (long)** summary buttons next to every Hacker News story. Clicking a button fetches the linked page's clean text via **Jina Reader**, summarizes it via **OpenRouter**, and renders the result inline in an HN‑native panel. All logic runs client‑side; the user supplies their own API keys through a settings popup.

---

## 1. Goals & requirements

| # | Requirement | How it's met |
|---|-------------|--------------|
| 1 | Button on HN to summarize the linked content | Per‑story controls injected by a content script |
| 2 | Two buttons: `+` (short), `++` (long), big enough to tap on mobile | Injected chip‑style links with ≥44px tap targets |
| 3 | Fetch page content via Jina Reader | Service worker calls `https://r.jina.ai/<url>` |
| 4 | Show fetch failures in **red** | The **button that triggered it** turns red; `title=` shows a curated human message; the raw error goes to `console.error` only (§7.1) |
| 5 | Imitate HN design system / reuse its components | Reuse HN's Verdana / `#ff6600` / `#828282` / `#f6f6ef` tokens & link styles |
| 6 | Settings popup: Jina key, OpenRouter key, model | `action.default_popup` → form persisted to `chrome.storage.local` |
| 7 | No hard error without creds; buttons **grayed out**; `title=` tooltip prompts to add creds | Disabled state gated on presence of both keys + model |
| 8 | Everything runs frontend | No backend; browser‑side fetches only |
| 9 | Implement in **JavaScript** | Vanilla ES modules, no TypeScript, no build/bundler step |
| 10 | Button toggles `+`→`-` (and `++`→`--`) when its summary is shown; pressing it contracts the summary | Per‑button state machine drives the label + collapses the panel (§5) |
| 11 | Cache the final summary in local storage, keyed on link + `+`/`++` | `localStorage` under `hnsum:<mode>:<url>` (§10) |

---

## 2. Architecture overview

Because **MV3 content scripts are subject to the host page's CORS policy even with `host_permissions`**, and only the **service worker / extension pages** can make CORS‑exempt cross‑origin requests, all network I/O is centralized in the background service worker. (Both Jina and OpenRouter are in fact CORS‑enabled, but routing through the service worker is the robust, canonical pattern and keeps keys out of the page's isolated world.)

```
┌─────────────────────────────┐        ┌───────────────────────────┐
│  Content script (HN page)   │        │  Popup (settings)         │
│  - scans tr.athing rows     │        │  - Jina key / OR key      │
│  - injects + / ++ buttons   │        │  - model picker           │
│  - renders inline panel      │        │  - writes chrome.storage  │
│  - reads settings from store │        └────────────┬──────────────┘
└──────────────┬──────────────┘                     │ storage.set
               │ runtime.sendMessage                 ▼
               │ {summarize,url,mode}        ┌───────────────────┐
               ▼                             │ chrome.storage.   │
┌─────────────────────────────┐  onChanged  │ local (settings + │
│  Service worker (background)│◀────────────│ summary cache)    │
│  1. fetch Jina Reader       │             └───────────────────┘
│  2. call OpenRouter         │
│  3. return summary/error     │
└─────────────────────────────┘
```

**Message flow (one summarize action):**
1. User taps `+`/`++` on a story.
2. Content script resolves the target URL and sends `{type:'summarize', url, mode:'short'|'long', storyId}` via `chrome.runtime.sendMessage` (returns a Promise).
3. Service worker: (a) `GET https://r.jina.ai/<url>` with `Accept: application/json` + Jina bearer key → `data.content` + `data.title`. (b) `POST https://openrouter.ai/api/v1/chat/completions` with the chosen model, a short/long system prompt, and the article text. 
4. Service worker resolves `{ok:true, title, summary}` or `{ok:false, stage:'fetch'|'summarize', error}`.
5. Content script renders the inline panel (summary, or **red** error).

---

## 3. File structure (vanilla JS, no build step)

Keeping it dependency‑free and buildless makes "Load unpacked" trivial and matches the "everything frontend" constraint.

```
hn-summary/
├── manifest.json
├── plan.md
├── icons/                 16.png · 48.png · 128.png
├── src/
│   ├── content.js         # scan rows, inject buttons, per-button state machine, panel, localStorage cache
│   ├── content.css        # HN-native styles for buttons (idle/red/disabled) + panel
│   ├── service-worker.js  # message handler; orchestrates Jina → OpenRouter; returns {ok,stage,curated,raw}
│   ├── popup.html         # settings form
│   ├── popup.css          # HN-flavored popup styling
│   ├── popup.js           # load/save settings, populate model list
│   └── lib/
│       ├── settings.js    # get/validate settings, "isConfigured" helper
│       ├── jina.js        # Jina Reader client (buildRequest, parse, errors)
│       ├── openrouter.js  # chat completions + models list
│       ├── errors.js      # curateError(): {stage,code,name} → human message (§7.1)
│       ├── prompts.js     # short/long system prompts
│       └── markdown.js    # minimal, escaped markdown → HTML (optional)
```

- Service worker declared with `"type":"module"` so it can `import` the `lib/*` modules.
- Content script stays a single classic script (no `import`) — it may inline small helpers or receive everything it needs via messages.
- Popup loads `popup.js` as `<script type="module">`.

---

## 4. `manifest.json` (MV3)

```jsonc
{
  "manifest_version": 3,
  "name": "HN Summary",
  "version": "0.1.0",
  "description": "Summarize the linked article for any Hacker News story.",
  "action": { "default_popup": "src/popup.html", "default_icon": { "16": "icons/16.png", "128": "icons/128.png" } },
  "background": { "service_worker": "src/service-worker.js", "type": "module" },
  "content_scripts": [{
    "matches": ["https://news.ycombinator.com/*"],
    "js": ["src/content.js"],
    "css": ["src/content.css"],
    "run_at": "document_idle"
  }],
  "permissions": ["storage"],
  "host_permissions": ["https://r.jina.ai/*", "https://openrouter.ai/*"]
}
```

Notes:
- We do **not** need `host_permissions` for the article's own origin because we never fetch it directly — Jina fetches it for us.
- `run_at: document_idle` (default) — HN is static server‑rendered, so a single injection pass on load suffices; a light `MutationObserver` is optional insurance.

---

## 5. Content script — DOM injection

**Verified HN structure (2026):** each story is `<tr class="athing submission" id="<id>">`; the title link is `span.titleline > a`; the metadata row is that row's `.nextElementSibling` containing `td.subtext > span.subline`.

**Per row:**
1. Select `document.querySelectorAll('tr.athing')`.
2. Resolve target URL from `row.querySelector('span.titleline > a')`:
   - **External article** — `href` is absolute (`http(s)://…`), `span.sitebit`/`sitestr` present → summarize that URL.
   - **Self/text post** (Ask HN, text Show HN, jobs) — `getAttribute('href')` starts with `item?id=` and no `sitebit` → summarize the HN discussion page `https://news.ycombinator.com/item?id=<id>` (so "summarize the link" still works for text posts).
3. Build a control group `<span class="hn-sum">` with two `<a>` chips: `+` and `++`. Guard against double‑injection with a `data-hn-sum` flag.
4. **Placement (recommended):** append to the subtext line (`row.nextElementSibling.querySelector('td.subtext .subline')`), next to the comments link — this is the natural "actions" row and avoids disturbing the title cell's `overflow:hidden`. (Alt: inline inside `span.titleline`; noted as a fallback.)
5. Insert the inline result panel container as a new full‑width `<tr>` placed right after the subtext row, initially empty/hidden.

**Enabled vs disabled state:**
- On load, read settings; compute `isConfigured = jinaKey && openrouterKey && model`.
- Enabled → chips are HN‑orange‑tinted, clickable.
- Disabled → `hn-sum--disabled` class (grey `#828282`, reduced opacity, `cursor:default`) and `title="Add your Jina and OpenRouter API keys and pick a model in the extension settings to enable summaries."` Clicking does nothing (optionally: open the popup / no‑op). **No error is thrown.**
- Subscribe to `chrome.storage.onChanged`; when keys/model change, toggle all chips live without a page reload.

**Per‑button state machine** — each chip (`+` short, `++` long) owns its own state; both share the one inline panel below the story, which shows whichever mode is currently expanded.

| State | Label | Appearance | Click does |
|-------|-------|-----------|-----------|
| `idle` | `+` / `++` | orange, enabled | start a summarize (or expand from cache) |
| `loading` | `…` (label held, subtle spinner) | dimmed, non‑re‑entrant | ignored until it resolves |
| `expanded` | **`-` / `--`** | orange | **collapse** the panel → back to `idle` (`+`), summary kept in cache |
| `error` | `+` / `++` | **red** (`--hn-error`), `title=`curated message | retry the summarize |
| `disabled` | `+` / `++` | grey `#828282`, `title=`add‑creds prompt | no‑op |

- **Toggle semantics (req #10):** when a summary is displayed, that button reads `-`/`--`; pressing it contracts the panel and the label reverts to `+`/`++`. Only one mode is expanded at a time — clicking `++` while `+` is expanded swaps the panel content to the long summary, sets `++`→`--`, and resets `+`. The panel is retained (hidden) on collapse so re‑expanding is instant.
- **Cache‑first:** on click, look up `localStorage['hnsum:<mode>:<url>']` first; if present, render immediately (no network, no tokens) and go straight to `expanded`. Otherwise show the loading state, send `{type:'summarize', url, mode, storyId, fresh?}` to the service worker, await, then cache + render on success.
- **Error handling (req #4):** on `{ok:false}`, set the *triggering* button to the `error` state — turn it **red** and set its `title` to the curated message (§7.1); the content script also does `console.error(rawError)` so the real error is visible only in the page console. The button stays clickable to retry; a later success clears the red state.
- A small "↻" refresh affordance re‑runs with `fresh:true` (Jina `X-No-Cache` + overwrite the cache entry).

**Safety:** model output is rendered via `textContent` or the minimal escaped markdown renderer — never `innerHTML` of raw model/page text (XSS hygiene).

---

## 6. Jina Reader integration (`lib/jina.js`)

**Request (from service worker):**
```
GET https://r.jina.ai/<encoded target URL>
Headers:
  Authorization: Bearer <jinaKey>
  Accept: application/json
  X-Return-Format: markdown
  X-Retain-Images: none          # text-only, cheaper output
  X-Timeout: 15
  # optional: X-No-Cache: true   # on explicit refresh
```
Use the URL‑prefix form for normal links; fall back to `POST https://r.jina.ai/` with `{"url":"…"}` for very long/hash‑routed URLs.

**Response** (`Accept: application/json`):
```json
{ "code":200, "status":20000,
  "data": { "title":"…", "url":"…", "content":"…markdown…", "usage":{"tokens":1234} } }
```
Read `data.title` + `data.content`. Truncate `content` to a sensible char budget before sending to the LLM (also available: `X-Max-Tokens` to cap at the source).

**Errors** → same envelope with `data:null`, fields `code`/`status`/`name`/`message`. Map to a friendly message; **401** (auth/bad‑reputation) prompts "check your Jina key", **429** → "rate limited, retry", timeouts → "page took too long". Any failure surfaces **red** in the panel with `name`/`message`.

---

## 7. OpenRouter integration (`lib/openrouter.js`)

**Summarize:**
```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer <openrouterKey>
  Content-Type: application/json
  HTTP-Referer: https://news.ycombinator.com/   # optional attribution
  X-Title: HN Summary
Body: {
  "model": "<settings.model>",
  "messages": [ {role:"system", content: PROMPT[mode]}, {role:"user", content: `${title}\n\n${articleText}`} ],
  "max_tokens": mode==='short' ? 1000 : 2000,
  "temperature": 0.3,
  "reasoning": { "effort": "low", "exclude": true }
}
```
Response is OpenAI‑shaped → `choices[0].message.content`; `usage` optionally shown. **Reasoning models** (gpt‑5, o‑series, r1) count reasoning tokens against `max_tokens`, so a tight cap returns empty content — hence the generous caps + `reasoning.effort:low`. Empty content (any model) maps to "Model returned no summary — try another model".

**Prompts (`lib/prompts.js`):**
- `short` — "Give a 2–3 sentence TL;DR of the article. No preamble."
- `long` — "Summarize the article: one‑sentence overview, then 4–7 concise bullet points of the key claims/takeaways. Neutral tone, no preamble."

**Model picker:** populate from the **public** `GET https://openrouter.ai/api/v1/models` (no key needed) → dropdown of `id` (+ friendly `name`, `context_length`, price). Provide a free‑text fallback so users can enter any slug. A single chosen model is used for both `+` and `++` (only the prompt and `max_tokens` differ). Suggested default: a cheap, fast model (e.g. an `…-mini`/`…:free` slug).

**Errors** → `{error:{code,message,metadata.error_type}}` with HTTP status == code. Mapped to curated messages in §7.1.

**Deferred (Phase 3) streaming:** `stream:true` → parse SSE from `response.body.getReader()` in the service worker, forward deltas to the content script over a `chrome.runtime.connect` **port** for progressive rendering. Ignore `: OPENROUTER PROCESSING` keep‑alive comments; stop on `data: [DONE]`.

---

## 7.1 Error taxonomy & reporting

The service worker never throws to the UI — it resolves `{ok:false, stage, code, curated, raw}`:
- `stage` — `'fetch'` (Jina) or `'summarize'` (OpenRouter).
- `curated` — a short human‑readable message (below) shown in the button's `title=`.
- `raw` — the real error string (HTTP status + response body, or the caught exception). The content script logs **only** this via `console.error` — it is never shown in the UI.

`curateError({stage, code, name})` maps to one of a small curated set; unmatched cases fall back to the stage default:

| Condition | Curated `title=` message |
|-----------|--------------------------|
| Jina — default / unreachable / 422 / timeout | **"Couldn't fetch the page"** |
| Jina — 401 / auth / bad reputation | "Jina key rejected — check it in settings" |
| Jina — 429 | "Jina rate limit — try again shortly" |
| OpenRouter — default | **"API error"** |
| OpenRouter — 401 | "OpenRouter key rejected — check it in settings" |
| OpenRouter — 402 | "Out of OpenRouter credits" |
| OpenRouter — 429 | "Rate limited — try again shortly" |
| OpenRouter — 502 / 503 | "Model unavailable — try another model" |
| Either — network/offline (fetch threw) | "Network error — check your connection" |

The two required anchors are the stage defaults — **"Couldn't fetch the page"** (page can't fetch) and **"API error"** — with the curated overrides layered on top. On any `{ok:false}`, the triggering button turns **red** and gets the `curated` title; `console.error(raw)` runs in the page console.

---

## 8. Settings popup

**Fields (persisted to `chrome.storage.local`):**
- `jinaKey` — password input (link to jina.ai/api-dashboard to get one).
- `openrouterKey` — password input (link to openrouter.ai/keys).
- `model` — searchable `<select>` populated from the public models endpoint, with a manual‑entry fallback.
- Optional: a **Test** button per key (Jina: fetch example.com; OpenRouter: `GET /api/v1/key` → show remaining credit) with green/red status.

**Behavior:**
- Load current values on open; Save writes to storage → fires `storage.onChanged` → content script re‑enables buttons live.
- Popup styled to feel HN‑native (Verdana, `#f6f6ef` background, `#ff6600` accents, `#828282` labels).
- **Security note (documented in‑UI):** `chrome.storage.local` is not encrypted; keys are the user's own. This is acceptable for a personal/self‑keyed extension. (Alternative for public distribution: OpenRouter's OAuth PKCE flow to mint per‑user keys — out of scope for v1.)

---

## 9. HN design system tokens

Reuse HN's own values so injected UI reads as native (source: `news.css`, live 2026):

| Token | Value | Use |
|-------|-------|-----|
| Orange | `#ff6600` | button accent / active state |
| Beige bg | `#f6f6ef` | panel + popup background |
| Muted gray | `#828282` | disabled buttons, meta text, borders |
| Nav text | `#222222` | body text |
| **Error red** | `#c00` (or `red`) | failed‑fetch / error messages |
| Font | `Verdana, Geneva, sans-serif` | everything |
| Sizes | title `10pt`/`11pt` mobile · subtext `7pt`/`9pt` mobile | match context |

- Buttons look like HN links but with **padding to guarantee ≥44×44px touch targets** on mobile (e.g. `padding:8px 12px; min-width:44px; text-align:center; display:inline-block`), a subtle border/hover, and orange text when enabled.
- Injected CSS via `content_scripts[].css` runs in the isolated world and is **not blocked** by HN's CSP.

---

## 10. Edge cases & decisions

- **Text/Ask/job posts** → summarize the HN item page instead of an external URL (handled in §5). 
- **PDF / non‑HTML links** → Jina parses many document types; pass through and let it try; on failure show red.
- **Duplicate injection / "More" pagination** → idempotent `data-hn-sum` guard + optional `MutationObserver`.
- **Long articles** → truncate Jina content to a char/token budget before the LLM call to control cost; note truncation in the panel if applied.
- **Summary cache (req #11)** → the final summary is persisted in `localStorage` under key `hnsum:<mode>:<url>` (mode = `short`|`long`), storing `{ title, body, model, ts }` as JSON. Cache‑first on every click → instant re‑expand, zero token re‑spend. The content script reads/writes `window.localStorage` directly (same‑origin `news.ycombinator.com` store; entries namespaced by the `hnsum:` prefix). Optional size cap / LRU eviction and a TTL via `ts` if the store grows large. `↻` refresh overwrites the entry.
- **Cost control** → the `localStorage` cache above; `X-Retain-Images:none`; capped `max_tokens`.
- **Rate limits** → surface 429s clearly; simple exponential backoff on retryable errors.
- **Keyless Jina** → unreliable off residential IPs (datacenter blocks); we require a user key, consistent with requirement #7.

---

## 11. Phased build

**Phase 0 — Scaffold**
- `manifest.json`, icons, empty service worker, popup shell, content script that injects static (non‑functional) `+`/`++` chips styled HN‑native. Verify Load Unpacked + injection on HN.

**Phase 1 — Settings**
- Popup form + `lib/settings.js`; persist to storage; populate model dropdown from public models endpoint; live enable/disable of chips via `storage.onChanged`; disabled tooltip.

**Phase 2 — Summarize (core)**
- Service worker message handler; `lib/jina.js` + `lib/openrouter.js` + `lib/errors.js`; inline panel with loading / success states; per‑button state machine with the `+`→`-` collapse toggle; **red button + curated `title=`** on failure with `console.error(raw)`; `localStorage` summary cache keyed on link + mode; `↻` refresh. This delivers the full feature.

**Phase 3 — Polish**
- Minimal markdown rendering for long summaries; per‑key Test buttons + credit display; SSE streaming for progressive output; `MutationObserver`; keyboard/a11y niceties.

---

## 12. Confirmed decisions

1. **Summary placement** — ✅ inline expanding panel (full‑width `<tr>`) below the story.
2. **Buttons location** — ✅ in the subtext/metadata line, next to the comments link.
3. **Model config** — ✅ a single model used for both `+` and `++`.
4. **Streaming** — ✅ ship non‑streaming in v1; SSE streaming deferred to Phase 3.
5. **Scope of pages** — all HN lists + item pages via `news.ycombinator.com/*`.
