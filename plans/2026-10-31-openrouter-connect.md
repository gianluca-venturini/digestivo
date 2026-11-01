# Plan: "Connect OpenRouter" with one click (OAuth PKCE)

Version target: **0.4.0**. Status: implemented and tested on desktop Chromium
with a mock OpenRouter (2026-10-31). Not yet tested with a real OpenRouter
account, or on Orion iOS (section 6.2).

## 1. Goal

- Add a **Connect OpenRouter** button to the settings popup, in the OpenRouter
  part (shown when the summary engine is **OpenRouter**; see
  [2026-10-31-on-device-summarizer.md](2026-10-31-on-device-summarizer.md)). One click opens
  OpenRouter. The user logs in and allows access. The extension then gets its
  own OpenRouter key. The user does not copy or paste a key.
- Keep the key field. A user can still paste a key. The button is an extra
  option, not a replacement.
- Make it work on desktop Chrome and on Orion iOS with the same code.
- Send the OpenRouter app headers on every OpenRouter call, so that the
  extension shows in the OpenRouter app rankings.

Out of scope: other providers, a credit limit on the new key (section 7), a
"headless" flow where the user copies a code.

## 2. How the OpenRouter flow works

Source: [OpenRouter OAuth PKCE guide](https://openrouter.ai/docs/guides/overview/auth/oauth).

1. The app makes a random secret (`code_verifier`) and its SHA-256 hash
   (`code_challenge`).
2. The app opens
   `https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256&state=…&key_label=…`.
3. The user logs in and allows access. OpenRouter goes to
   `callback_url?code=…&state=…`. `state` comes back unchanged.
4. The app sends `POST https://openrouter.ai/api/v1/auth/keys` with
   `{ code, code_verifier, code_challenge_method: 'S256' }`. The reply is
   `{ key, user_id }`. The code works one time only and expires after 10 minutes.

Facts I checked (2026-10-31, with `curl`):

- `/api/v1/auth/keys` and `/api/v1/chat/completions` reply to a CORS preflight
  from `Origin: https://news.ycombinator.com` with
  `Access-Control-Allow-Origin: *`. The allowed headers include
  `HTTP-Referer`, `X-OpenRouter-Title`, and `X-Title`. So the content script
  can call both endpoints.
- A wrong code gives `400 {"error":{"message":"Invalid code","code":400}}`.
- `/auth` sends a logged-out user to `/sign-up` first. OpenRouter checks the
  `callback_url` only after login. So only a real account can test the full flow
  (section 6.2).

Callback rule: "https URLs and localhost/127.0.0.1 URLs on any port"
([API reference](https://openrouter.ai/docs/api/api-reference/oauth/create-authorization-code.md)).
`chrome-extension://` URLs are not https, so OpenRouter does not accept them.

## 3. Design

### 3.1 Where OpenRouter sends the user back

| Option | Desktop Chrome | Orion iOS | Safari | Cost |
|---|---|---|---|---|
| `chrome.identity.launchWebAuthFlow` (`https://<id>.chromiumapp.org/`) | Yes | Not sure: Kagi's table says yes, [Orion #8750](https://orionfeedback.org/d/8750) says "only placeholder" | No | New `identity` permission. Two code paths. Nobody has confirmed that OpenRouter accepts `chromiumapp.org`. |
| A new page on GitHub Pages + a new content script for it | Yes | Yes | Yes | Hosting to set up and keep. |
| **`https://news.ycombinator.com/` + the content script that already runs there** | Yes | Yes | Yes | None. |

**Choice: `https://news.ycombinator.com/`.**

- The content script already runs on every HN page. No new permission, no new
  host, no new script.
- After the connection, the user is on the HN front page and can click `(+)`
  at once.
- The same code runs on all browsers.

Effect: HN's server sees the one-time `code` in the URL (in its logs). This is
safe because the code is useless without the `code_verifier`. Only this
browser has the `code_verifier`. This is the purpose of PKCE.

### 3.2 Flow

```
Popup                                  OpenRouter                     HN page (content script)
-----                                  ----------                     ------------------------
click "Connect OpenRouter"
  make verifier, challenge, state
  storage.local.oauthPending =
    {verifier, state, createdAt}
  tabs.create(openrouter.ai/auth?…)  -> log in, allow
                                        redirect to
                                        news.ycombinator.com/?code=…&state=… ->
                                                                     read code + state
                                                                     state = oauthPending.state ? else do nothing
                                                                     remove code + state from the URL
                                                                     remove oauthPending (one try only)
                                                                     POST /api/v1/auth/keys
                                                                     storage.local.set({openrouterKey, authMethod:'oauth', …})
                                                                     show "OpenRouter connected" bar
                                                                     enable (+) / (++)
```

Decisions:

| Decision | Choice | Reason |
|---|---|---|
| Who opens OpenRouter | The popup, with `chrome.tabs.create` | The Kagi table marks `tabs.create` as fully supported on iOS. No `tabs` permission is needed. If `chrome.tabs` is missing, use `window.open`. |
| Where to keep the verifier | `chrome.storage.local`, written **before** the tab opens | The popup closes when the tab opens, and its memory is lost. |
| Who exchanges the code | The content script | CORS is OK (section 2). The content script already calls OpenRouter on Orion. It does not use the background, so Orion bug [#8179](https://orionfeedback.org/d/8179) has no effect. |
| Check of the callback | `state` (16 random bytes) must equal `oauthPending.state`. `oauthPending` must be less than 15 minutes old. | Anyone can post an HN link with `?code=…&state=…`. Without the correct `state`, the content script does nothing. |
| One try only | Remove `oauthPending` before the exchange | Reloading the page does not send the code again. |
| URL cleanup | `history.replaceState` removes `code` and `state` | The code does not stay in the address bar or in history. |
| Key name | `key_label=HN Summary` | Without it, OpenRouter names the key after the callback host ([nova #4](https://github.com/AutumnsGrove/nova/issues/4)). The user then sees "HN Summary" in [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys). |
| Model | If no model is set, set `openai/gpt-4o-mini` | So one click is enough. It is the model in the field hint today. It is on OpenRouter today ($0.15 / $0.60 per million tokens). |
| Engine | On success, also write `engine: 'openrouter'` | The default engine is on-device. The user connected OpenRouter, so they want to use it. |
| Welcome page | Connect does not close the page when the popup runs as the welcome tab (`?welcome=1`) | It is a normal tab, not a popup. |
| Mark the source of the key | `authMethod: 'oauth'` or `'manual'`, `connectedAt` | The popup shows "Connected" and a **Disconnect** button only for a key from the flow. |
| Disconnect | Remove `openrouterKey`, `authMethod`, `connectedAt` from storage. Tell the user to delete the key in openrouter.ai/settings/keys. | An extension cannot delete an OpenRouter key without a management key. |
| Background script | No change | |

### 3.3 App attribution headers

Source: [OpenRouter app attribution](https://openrouter.ai/docs/app-attribution).

- `HTTP-Referer` is required. "Without it, no app page will be created."
- `X-OpenRouter-Title` sets the name. `X-Title` still works.

Today the content script sends `HTTP-Referer: https://news.ycombinator.com/`.
So OpenRouter counts the use for Hacker News, not for this extension. Change:

| Header | Value |
|---|---|
| `HTTP-Referer` | `https://github.com/gianluca-venturini/digestivo` (the public repo) |
| `X-OpenRouter-Title` | `HN Summary` |
| `X-Title` | `HN Summary` (old name, kept for safety) |

Send them on `chat/completions` and on `auth/keys`. Keep them in one constant
in `content.js`.

Note: the app page is `openrouter.ai/apps?url=<HTTP-Referer>`. If the Referer
changes later (for example, to the Chrome Web Store URL), the ranking starts
again from zero. Select the URL one time.

## 4. Changes per file

### 4.1 `manifest.json`

- `version` → `0.4.0`. No new permission.

### 4.2 `src/lib/settings.js`

- `KEYS`: add `authMethod`, `connectedAt`.
- The default model `openai/gpt-4o-mini` is only in `content.js`, because
  only `finishConnect()` uses it.

### 4.3 `src/lib/oauth.js` (new, ES module, used by the popup)

- `OPENROUTER_AUTH = 'https://openrouter.ai/auth'`,
  `CALLBACK_URL = 'https://news.ycombinator.com/'`.
- `base64url(bytes)`, `randomString(n)` (from `crypto.getRandomValues`).
- `startConnect()`:
  1. `verifier = randomString(32)`, `state = randomString(16)`.
  2. `challenge = base64url(sha256(verifier))` with `crypto.subtle.digest`.
  3. `storage.local.set({ oauthPending: { verifier, state, createdAt } })`.
  4. Return the auth URL with `callback_url`, `code_challenge`,
     `code_challenge_method=S256`, `state`, and `key_label=HN Summary`.

### 4.4 `src/popup.html`, `src/popup.js`, `src/popup.css`

New layout of the OpenRouter part (`#openrouterFields`, shown only when the
engine is OpenRouter):

```
(•) OpenRouter
[ Connect OpenRouter ]            (orange button)
Opens OpenRouter. Log in and allow access. No key to copy.

or paste an API key
[ sk-or-...                   ]
Get an OpenRouter key →
```

When `authMethod === 'oauth'` and there is a key:

```
(•) OpenRouter
✓ Connected to OpenRouter (2026-10-31)   Disconnect
```

- The key field is hidden in this state. **Disconnect** returns to the first layout.
- Connect click: `url = await startConnect()`, then
  `chrome.tabs.create({ url })` (or `window.open`), then `window.close()`
  (not on the welcome tab).
- Save: if the key in the field is different from the stored key, set
  `authMethod: 'manual'` and remove `connectedAt`.
- Disconnect: remove the key data. Show "Disconnected. To delete the key, go
  to openrouter.ai/settings/keys."
- Note text: "Your OpenRouter key is stored only in this browser …" stays.

### 4.5 `src/content.js`

1. `const APP_HEADERS = { 'HTTP-Referer': APP_URL, 'X-OpenRouter-Title': 'HN Summary', 'X-Title': 'HN Summary' }`.
   Use it in `summarizeText`.
2. `finishConnect()`, called one time at start, before `injectAll`:
   - Read `code` and `state` from `location.search`. If one is missing, return.
   - Read `oauthPending`. If it is missing, return. Do not change the URL.
     (The link is not from our flow.)
   - If `state` is not equal, the user clicked Connect again after this tab
     opened. Remove `code` and `state` from the URL. Keep `oauthPending` for
     the newest tab. Show the error bar "This OpenRouter tab is old. Use the
     newest OpenRouter tab, or open the extension and click Connect
     OpenRouter again."
   - Remove `code` and `state` from the URL with `history.replaceState`.
   - Remove `oauthPending`. (A code works one time only, so a second try with
     the same code cannot work.)
   - If it is more than 15 minutes old: show the error bar "The connection
     took too long. Open the extension and click Connect OpenRouter again."
   - `POST /api/v1/auth/keys` with `APP_HEADERS` and `Content-Type`.
   - If OK and `key` is a string: write `engine: 'openrouter'`, `openrouterKey`, `authMethod: 'oauth'`,
     `connectedAt`, and `model` (only if no model is set). The
     `storage.onChanged` listener loads the settings and enables the
     buttons. Show the bar "OpenRouter connected. Click (+) or (++) next to
     a story to summarize it."
   - Else: show the error bar "Could not connect OpenRouter (HTTP n). Open
     the extension and click Connect OpenRouter again, or paste a key." Write
     the raw error to `console.error`.
3. The bar: one `div.hn-sum-banner` at the top of `#hnmain` (or `body`), with
   an `×` `<button>` to close it (the keyboard can reach it). Green-grey for OK, red text for errors. HN fonts
   and colors.
4. `DISABLED_TITLE.openrouter`: "Connect OpenRouter (or paste a key) and pick a model in
   the extension settings to enable summaries."
5. `curateError` 401: "OpenRouter key rejected. Connect again or check the key
   in settings."

### 4.6 Documents

- `PRIVACY.md`: add a part about **Connect OpenRouter**. It opens openrouter.ai.
  OpenRouter returns a one-time code through a `news.ycombinator.com` URL.
  HN can see this code, but the code is useless without a secret that stays in
  the browser. The extension saves the new key locally. The OpenRouter
  requests have headers that name the extension (not the user). New date.
- `README.md`: setup step 4: "click **Connect OpenRouter** (or paste a key)".
  Add the flow to "How it works". Upload package name `v0.4.0`.
- `store-assets/listing.md`: mention the one-click connection.

## 5. Security notes

- PKCE with S256. The verifier never leaves the browser except in the
  exchange call to OpenRouter.
- `state` stops a link from another person from starting an exchange. Even
  without `state`, a foreign code would fail, because the verifier would not
  match.
- The new key has no credit limit. The user can set a limit or delete the key
  in openrouter.ai/settings/keys. An extension cannot set a limit (section 7).
- The key is stored as today: `chrome.storage.local`.

## 6. Test plan

### 6.1 Chromium (Playwright, automatic)

Fake HN page and fake OpenRouter (`/auth` sends the browser at once to the
callback; `/auth/keys` checks that `sha256(code_verifier)` equals the
challenge).

| # | Case | Expected |
|---|---|---|
| 1 | Popup with no key | "Connect OpenRouter" button and key field show |
| 2 | Click Connect | A new tab opens `openrouter.ai/auth` with `callback_url`, `code_challenge` (43 characters), `S256`, `state`, `key_label` |
| 3 | Callback | Exchange is called with the correct verifier. Key, `authMethod: 'oauth'`, default model are stored. Green bar shows. URL has no `code`/`state`. Buttons are enabled. |
| 4 | Summary after connect | `chat/completions` gets `Bearer <new key>`, `HTTP-Referer` = repo URL, `X-OpenRouter-Title` |
| 5 | Reload the callback URL | No second exchange |
| 6 | HN link with a wrong `state` | No exchange. URL not changed. No bar. |
| 7 | Exchange gives 400 | Red bar. No key stored. |
| 8 | `oauthPending` 20 minutes old | Red "took too long" bar. No exchange. |
| 9 | Model already set | Model not changed |
| 10 | Popup after connect | "Connected" + Disconnect. Key field hidden. |
| 11 | Disconnect | Key data removed. Buttons grey on HN. |
| 12 | Paste key + Save | `authMethod: 'manual'`. Summaries work as before. |

### 6.2 Manual (real OpenRouter account)

- Desktop Chrome: load `dist/hn-summary-v0.4.0.zip` unpacked. Click Connect,
  log in, allow. Check the consent page text, the key name "HN Summary" in
  openrouter.ai/settings/keys, and one summary.
- Orion iOS: the same. Also check that the popup opens the tab, and that the
  login (Google or email) works in Orion.
- After some days, check `openrouter.ai/apps?url=https://github.com/gianluca-venturini/digestivo`.

## 7. Limits and risks

- OpenRouter checks the callback only after login. If it refuses
  `https://news.ycombinator.com/`, use a GitHub Pages page as the callback and
  add it to the content script matches.
- The `/auth` URL has no documented parameter for a credit limit or an expiry
  date. Those exist only on `POST /api/v1/auth/keys/code`, which needs a
  management key.
- On Orion iOS, the popup may not open a tab. Fallback: `window.open`. If both
  fail, the user can paste a key.
- If OpenRouter shows the callback host on the consent page, the user sees
  "news.ycombinator.com". `key_label` may change this. Check in 6.2.

## 8. Order of work

1. Done: `settings.js`, `oauth.js`, popup.
2. Done: `content.js`: `finishConnect`, bar, headers, messages.
3. Done: documents, version `0.4.0`.
4. Done: test 6.1. Results below.
5. Done: `./build.sh` → `dist/hn-summary-v0.4.0.zip`.
6. To do: test 6.2 on desktop Chrome and Orion iOS. Record the results here.

### Desktop results (Playwright Chromium 1.64.1, 2026-10-31)

- After the rebase on `main` (on-device engine) and the code review fixes:
  21 of 21 checks in 6.1 passed, on the source folder and on the unzipped
  `dist/hn-summary-v0.4.0.zip`. The on-device test from `main` passed: 29 of
  29.
- Code review fixes, each with a test that fails on the old code:
  - The welcome page stays open during Connect. It now shows changes from
    other tabs. Save does not write the key when the key field is hidden.
    Before, Save on that page deleted the new key.
  - An old OpenRouter tab (the user clicked Connect two times) now shows a
    red bar. Before, nothing happened.
  - The bar's `×` is a `<button>`. Before, the keyboard could not reach it.
  - Error bars say "click Connect OpenRouter again", because the code works
    one time only.
- The 0.2.0 summary test (12 real links, mock OpenRouter) passed again: 12 of
  12, 0 unexpected requests.
- Problem found and fixed: the "Connected" date in the popup used UTC (it
  showed the next day in the evening). It now uses the local date.
- Real OpenRouter: the new tab opened the real `/auth` URL. OpenRouter sent it
  to `/sign-up` (logged out), as expected. The test then played the
  OpenRouter redirect itself.
- Note for tests: a tab that the extension opens with `tabs.create` does not
  use Playwright routes on its first load.

## 9. Sources

- OpenRouter OAuth PKCE guide: https://openrouter.ai/docs/guides/overview/auth/oauth
- OpenRouter, create authorization code (callback rule, `limit`, `key_label`): https://openrouter.ai/docs/api/api-reference/oauth/create-authorization-code.md
- OpenRouter, exchange code for key: https://openrouter.ai/docs/api/api-reference/oauth/exchange-authorization-code-for-api-key.md
- OpenRouter app attribution: https://openrouter.ai/docs/app-attribution
- Chrome identity API (`chromiumapp.org`): https://developer.chrome.com/docs/extensions/reference/api/identity
- MDN identity support table: https://raw.githubusercontent.com/mdn/browser-compat-data/main/webextensions/api/identity.json
- Orion #8750, identity API on iOS is a placeholder: https://orionfeedback.org/d/8750
- Orion #8179, content script to background messages stop on iOS: https://orionfeedback.org/d/8179
- Kagi Orion API support table: https://docs.google.com/spreadsheets/d/14IgSRVop4psUTgtLZlvYJYrAArhvL3WvRlUdzdQbIoQ
- Key name without `key_label`: https://github.com/AutumnsGrove/nova/issues/4
