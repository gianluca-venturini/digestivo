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
