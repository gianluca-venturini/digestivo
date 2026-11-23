#!/usr/bin/env bash
# Stops the build if the text extraction could use the network.
#
# 1. src/vendor/defuddle.js must be the exact file that was reviewed
#    (Defuddle 0.19.6, see src/vendor/README.md).
# 2. src/content.js must call Defuddle parse() only, with the network locks.
# 3. Nothing may call Jina.
# 4. src/vendor/pdf*.min.js must be the reviewed pdf.js files, and
#    src/background.js must call pdf.js with the safe options.
set -euo pipefail
cd "$(dirname "$0")/.."

REVIEWED_SHA256="f40075dc7b7b0460c16f77b9486a0ee66907a19677d2984e198e94356116a1e8"
# pdf.js 3.11.174, legacy build (see src/vendor/README.md).
PDFJS_SHA256="978fd1b2d134a98e98966186a97777bebf87d8e770dadab1ece3687e21a5aa6c"
PDFJS_WORKER_SHA256="38cde5311957b86bc3669f93e7d2566de333a90055ed6635bef60d9bf00e96f2"
fail() { echo "verify-vendor: $*" >&2; exit 1; }

got=$(shasum -a 256 src/vendor/defuddle.js | cut -d' ' -f1)
[ "$got" = "$REVIEWED_SHA256" ] ||
  fail "src/vendor/defuddle.js is not the reviewed file. Review the new file (src/vendor/README.md), then update REVIEWED_SHA256."

[ "$(shasum -a 256 src/vendor/pdf.min.js | cut -d' ' -f1)" = "$PDFJS_SHA256" ] ||
  fail "src/vendor/pdf.min.js is not the reviewed file. See src/vendor/README.md."
[ "$(shasum -a 256 src/vendor/pdf.worker.min.js | cut -d' ' -f1)" = "$PDFJS_WORKER_SHA256" ] ||
  fail "src/vendor/pdf.worker.min.js is not the reviewed file. See src/vendor/README.md."

# pdf.js 3.11 has CVE-2024-4367. isEvalSupported: false is the fix for 3.x.
# Match the option lines only (indented, with a comma), not the comments.
grep -q -E '^[[:space:]]+isEvalSupported: false,$' src/background.js ||
  fail "src/background.js must pass isEvalSupported: false to pdf.js."
grep -q -E '^[[:space:]]+disableFontFace: true,$' src/background.js ||
  fail "src/background.js must pass disableFontFace: true to pdf.js."
if grep -n -E '(cMapUrl|standardFontDataUrl)[[:space:]]*:' src/background.js; then
  fail "pdf.js must not get cMapUrl or standardFontDataUrl: it would download files."
fi

if grep -n -E '\.(parseAsync|fetchAsyncVariables)[[:space:]]*\(|\[[^]]*(parseAsync|fetchAsyncVariables)' src/content.js; then
  fail "src/content.js must not call Defuddle parseAsync() or fetchAsyncVariables(). They use the network."
fi
grep -q 'useAsync: false' src/content.js || fail "src/content.js must pass useAsync: false to Defuddle."
grep -q 'fetch: blockedFetch' src/content.js || fail "src/content.js must pass fetch: blockedFetch to Defuddle."

if grep -n -E '^\s*import\s' src/background.js; then
  fail "src/background.js must be a classic script (no import). Orion iOS needs this."
fi

if grep -rn -i 'jina\.ai' manifest.json src --include='*.js' --include='*.json' --include='*.html'; then
  fail "Jina is still called."
fi

echo "verify-vendor: ok"
