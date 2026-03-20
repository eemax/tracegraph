#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

curl -fsS "http://127.0.0.1:48292/api/health" >/dev/null
curl -fsS "http://127.0.0.1:48292/api/events?limit=3" >/dev/null

echo "[smoke] api health + events endpoint reachable"
