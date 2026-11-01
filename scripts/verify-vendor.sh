#!/usr/bin/env bash
# Stops the build if the text extraction could use the network.
#
# 1. src/vendor/defuddle.js must be the exact file that was reviewed
#    (Defuddle 0.19.6, see src/vendor/README.md).
# 2. src/content.js must call Defuddle parse() only, with the network locks.
# 3. Nothing may call Jina.
set -euo pipefail
cd "$(dirname "$0")/.."

REVIEWED_SHA256="f40075dc7b7b0460c16f77b9486a0ee66907a19677d2984e198e94356116a1e8"
fail() { echo "verify-vendor: $*" >&2; exit 1; }

got=$(shasum -a 256 src/vendor/defuddle.js | cut -d' ' -f1)
[ "$got" = "$REVIEWED_SHA256" ] ||
  fail "src/vendor/defuddle.js is not the reviewed file. Review the new file (src/vendor/README.md), then update REVIEWED_SHA256."

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
