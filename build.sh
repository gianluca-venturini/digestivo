#!/usr/bin/env bash
# Package the extension into a Chrome Web Store-ready zip under dist/.
# Usage: ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

# Stop if the text extraction could use the network.
./scripts/verify-vendor.sh

# Read the version from manifest.json (no dependencies).
VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -1)
if [ -z "$VERSION" ]; then
  echo "error: could not read \"version\" from manifest.json" >&2
  exit 1
fi

OUT="dist/hn-summary-v${VERSION}.zip"

mkdir -p dist
rm -f dist/hn-summary-*.zip

# Only the files the extension needs — no docs, store assets, or dist.
zip -rq "$OUT" manifest.json icons src -x '*.DS_Store' 'src/vendor/README.md'

echo "built $OUT"
unzip -l "$OUT" | tail -1
