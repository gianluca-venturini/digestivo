# Plan: read PDFs, retry short server errors, respect Retry-After

Version target: **0.6.0**. Status: implemented on branch `claude/kind-euler-zrly0n`.
Tested in Chromium with the extension loaded and a stub Summarizer (Chromium has
no Gemini Nano). Not yet tested in Chrome with the real model, or in Orion.

Reason for MINOR: reading PDFs is a new feature.

## 1. Goal

A link check on 30 days of HN (top 3 pages a day, 2,690 links) found 568 links
that fail. This change fixes three causes:

| Cause | Links | Change |
|---|---|---|
| PDF links | 15 | Read the PDF text with pdf.js |
| HTTP 502/503/504 | about 10 | Retry one time after 1 s |
| HTTP 429 | 30 | Read `Retry-After`. 5 s or less: wait and retry one time. Else show "The site limits requests." |

Not in scope: a fallback to the HN discussion (the owner does not want it).

## 2. Design

All work is in the background script (`src/background.js`). The content
script only gets new error names and waits longer.

### Retries

- `fetchPage()` calls `fetchOnce()` one or two times. All the work for one
  page (permission check, block rules, both attempts) shares a budget of 30 s
  (`FETCH_BUDGET_MS`). One attempt has at most 20 s, and none starts with less than 1 s left.
- `retryDelayMs()` decides:
  - 502, 503, 504: wait `Retry-After` if it is 5 s or less, else 1 s if the
    header is missing. A `Retry-After` over 5 s: no retry.
  - 429: wait `Retry-After` if it is 5 s or less. Missing or longer: no retry.
  - All other results: no retry.
- No retry if less than wait + 2 s of the budget is left.
- `Retry-After` can be seconds or an HTTP date (`parseRetryAfter()`).
- The error details say "tried 2 times" after a retry.
- A failed response body is cancelled (not downloaded).

### Rate limit message

- The background returns `name: 'RateLimited'` and `retryAfter` (seconds or null).
- The panel shows "The site limits requests. Try again later." With a known
  wait, it adds "It asks to wait 2 min." (`waitWords()` in `src/content.js`).

### PDF

- pdf.js 3.11.174, legacy build, in `src/vendor/` (see `src/vendor/README.md`
  for why 3.11 and the CVE-2024-4367 fix `isEvalSupported: false`).
- Chrome loads it with `importScripts` at the top of `src/background.js`.
  Orion, Firefox and Safari load it from the manifest `"scripts"` list.
- A response is a PDF when the type is `application/pdf`, or the path ends in
  `.pdf` and the type is not text (servers use octet-stream, x-download,
  force-download, ...). The first 1 KB must contain `%PDF-`, else the error
  says the server did not send a PDF.
- Download limit 20 MB (a cut PDF cannot be read). Text limit: 60 pages or
  36,000 characters. 15 s to read the text.
- The background returns the text as `contentType: 'text/plain'` with the PDF
  title. The content script uses it like a plain text page.
- pdf.js runs on the background thread, so a timer cannot stop it. On the
  15 s limit, `task.destroy()` stops the work, and `pdfText()` checks the time
  between pages (it keeps the pages read so far).
- Text pieces get a space between them when the next piece starts on a new
  line or after a gap (`itemsToText()`), so words at column joins do not merge.
- New errors: `PdfTooLarge`, `PdfNoText` (scanned PDF), `PdfLocked`, `PdfFailed`.

### Wait in the content script

`FETCH_WAIT_MS` = 55 s for `hnsum:fetch` (30 s fetch budget + 15 s PDF text +
margin for a cold start). Other messages keep 25 s.

When the first reply does not arrive, the content script asks again (reply
method B). The background then gives the same work (`fetchShared()`): the
download that runs, or a result of the last 60 s. A slow PDF is not downloaded
and read two times.

## 3. Checks

- `scripts/verify-vendor.sh`: SHA-256 of both pdf.js files, the option lines
  `isEvalSupported: false,` and `disableFontFace: true,` (not comments), no
  `cMapUrl` or `standardFontDataUrl` option. Checked: removing the option line
  makes the build fail.
- Unit check in Chromium (service worker, mocked responses): 503 then 200 → ok
  after one retry; 503 always → fails after 2 tries; 502 with `Retry-After: 60`
  → no retry; 429 with `Retry-After: 2` or a date 3 s ahead → ok after one
  retry; 429 with 120 s or no header → no retry; 4 real PDFs → text; a PDF sent
as `application/force-download` → text; HTML sent as `application/pdf` →
"not a PDF" error; a second ask during a download → no second download.
- Link check: re-run all 590 earlier failures through the extension UI.

## 4. Open points

| Point | State |
|---|---|
| Orion iOS | Test a PDF link. 0.4.1 showed "background is not running" after 25 s on a PDF. |
| Service worker start | pdf.js adds about 1.5 MB to parse at each start. Measure in Chrome. |
| Store privacy form | PDF text is website content, like page text. No new data type. |
