#!/usr/bin/env bash
set -euo pipefail

exec NODE_ENV=production bun src/api.ts
