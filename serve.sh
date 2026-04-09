#!/usr/bin/env bash
set -euo pipefail

tailscale serve --bg --https=3000 http://localhost:3001

exec NODE_ENV=production bun src/api.ts
