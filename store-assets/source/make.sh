#!/usr/bin/env bash
# Makes the store screenshots and promo tiles again, from the current extension code.
# Output: store-assets/screenshot-*.png and store-assets/promo-*.png
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp "$HERE"/*.mjs "$HERE"/slides.json "$HERE"/summaries.json "$WORK"/
cp "$HERE/hn-snapshot.html" "$WORK/hn.html"
mkdir -p "$WORK/extcopy" "$WORK/raw" "$WORK/out"
cp -R "$REPO/manifest.json" "$REPO/icons" "$REPO/src" "$WORK/extcopy/"
# Headless Chromium has no Gemini Nano. Only this copy of the popup gets a stub.
cp "$HERE/mock-nano.js" "$WORK/extcopy/src/"
sed -i.bak 's#<script type="module" src="popup.js"></script>#<script src="mock-nano.js"></script><script type="module" src="popup.js"></script>#' "$WORK/extcopy/src/popup.html"

cd "$WORK"
npm init -y >/dev/null
npm install --silent playwright@1.56.1
npx playwright install chromium
node capture-popup.mjs
node capture-hn.mjs
node compose.mjs
node tiles.mjs
cp out/screenshot-*.png out/promo-*.png "$HERE/../"
echo "Done. Check the files in store-assets/. Half-size previews: $WORK/out/preview-*.png (deleted on exit)."
