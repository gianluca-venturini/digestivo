#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/home/gianluca/digestivo/hn"
PORT=8000
POLL_INTERVAL=10

current=""
serve_pid=""

get_latest() {
    find "$BASE_DIR" -maxdepth 2 -name "index.html" -printf '%h\n' 2>/dev/null \
        | xargs -I{} basename {} \
        | sort -r \
        | head -1
}

stop_serve() {
    if [[ -n "$serve_pid" ]] && kill -0 "$serve_pid" 2>/dev/null; then
        echo "[$(date)] Killing tailscale serve (pid $serve_pid)"
        kill "$serve_pid" 2>/dev/null || true
        wait "$serve_pid" 2>/dev/null || true
        serve_pid=""
    fi
}

serve() {
    local dir="$1"
    local path="$BASE_DIR/$dir/index.html"
    stop_serve
    echo "[$(date)] Serving $path"
    tailscale serve --https="$PORT" --set-path / "$path" &
    serve_pid=$!
    current="$dir"
}

cleanup() {
    echo "[$(date)] Stopping serve"
    stop_serve
    exit 0
}
trap cleanup SIGTERM SIGINT

# Initial serve
latest=$(get_latest)
if [[ -n "$latest" ]]; then
    serve "$latest"
else
    echo "[$(date)] No index.html found in $BASE_DIR, waiting..."
fi

# Poll for new directories
while true; do
    sleep "$POLL_INTERVAL"
    latest=$(get_latest)
    if [[ -n "$latest" && "$latest" != "$current" ]]; then
        serve "$latest"
    fi
done
