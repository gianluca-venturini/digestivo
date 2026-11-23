# Vendored files

## defuddle.js

- Package: [`defuddle`](https://www.npmjs.com/package/defuddle) version **0.19.6**
- File: `package/dist/index.js` from the npm tarball, not changed.
- License: MIT (`defuddle.LICENSE`).
- npm integrity: `sha512-VzIOHD5iKABZVQg2xcPYD/181rgfCO4Mtqay9rfYyXXewMSX+fI+XU3COMpi4YEW34EJuf0WC6f/52NlW9akIw==`
- SHA-256 of `defuddle.js`: `f40075dc7b7b0460c16f77b9486a0ee66907a19677d2984e198e94356116a1e8`

The file sets one global, `Defuddle` (the class).

### Why it stays local

Review of 0.19.6, done on 2026-10-31:

- The file has no `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`,
  `importScripts`, `import()`, `Worker`, `eval`, or `new Function`.
- It does not use the live page `document` or `window`. It uses only the
  document that we give to it.
- It has 13 `fetch` calls. All are in `async` extractor methods (YouTube,
  Reddit, X, bilibili, c2 wiki). Only `extractAsync()` calls them, and only
  `parseAsync()` and `fetchAsyncVariables()` call `extractAsync()`.
  `parse()` never calls them.
- All extractor requests go through `this.options.fetch || globalThis.fetch`.

`src/content.js` adds three locks:

1. It calls `parse()` only, with `useAsync: false`.
2. It gives `fetch: blockedFetch`, which makes every extractor request fail.
3. It parses the HTML with `DOMParser`. That document is inert: no scripts
   run, and no images or frames load.

`scripts/verify-vendor.sh` (run by `build.sh`) checks the SHA-256 of this file
and the locks in `src/content.js`.

### How to update

1. Download the new tarball and check its `integrity` against
   `https://registry.npmjs.org/defuddle/<version>`.
2. Copy `package/dist/index.js` to `src/vendor/defuddle.js`.
3. Do the review above again. Search for all network APIs, and for each
   `fetch` call find the function that contains it.
4. Update the version, hashes, and date in this file, and `REVIEWED_SHA256`
   in `scripts/verify-vendor.sh`.

## pdf.min.js and pdf.worker.min.js (pdf.js)

- Package: [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist) version **3.11.174**
- Files: `package/legacy/build/pdf.min.js` and `package/legacy/build/pdf.worker.min.js`
  from the npm tarball, not changed.
- License: Apache-2.0 (`pdfjs.LICENSE`).
- npm integrity: `sha512-TdTZPf1trZ8/UFu5Cx/GXB7GZM30LT+wWUNfsi6Bq8ePLnb+woNKtDymI2mxZYBpMbonNFqKmiz684DIfnd8dA==`
- SHA-256 of `pdf.min.js`: `978fd1b2d134a98e98966186a97777bebf87d8e770dadab1ece3687e21a5aa6c`
- SHA-256 of `pdf.worker.min.js`: `38cde5311957b86bc3669f93e7d2566de333a90055ed6635bef60d9bf00e96f2`

The files set two globals, `pdfjsLib` and `pdfjsWorker`. With `pdfjsWorker`
present, pdf.js runs in the same thread (no `Worker`). Only the background
script loads them: `importScripts` in Chrome (service worker), the manifest
`"scripts"` list in Orion, Firefox and Safari.

### Why version 3.11

pdf.js 4 and newer ship only ES modules. The background must stay a classic
script (Orion iOS). 3.11.174 is the last version with classic `.min.js` files.

### Why it stays safe and local

Added on 2026-11-23.

- **CVE-2024-4367** (code run through a crafted font) affects 3.11.174. The fix
  for 3.x is the option `isEvalSupported: false`. `src/background.js` passes it.
- `disableFontFace: true`: no fonts are made. We read text only, and never draw.
- pdf.js gets the bytes (`data`), never a URL. The background downloads the
  PDF with the same rules as a web page (permission check, block rules, no
  cookies), with a 20 MB limit.
- No `cMapUrl` and no `standardFontDataUrl`: pdf.js has no file to download.
  Some PDFs with CJK fonts can give wrong text because of this.

`scripts/verify-vendor.sh` checks the SHA-256 of both files and these options.

### How to update

1. Check the tarball `integrity` against `https://registry.npmjs.org/pdfjs-dist/<version>`.
2. A version 4 or newer needs a different loader (ES modules). Plan that first.
3. Copy the two legacy build files, then update the hashes here and in
   `scripts/verify-vendor.sh`.
