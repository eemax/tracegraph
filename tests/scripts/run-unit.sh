#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/tests/setup/env.sh"

cd "$ROOT_DIR"
echo "[tests] running unit suites"
bun run test:unit
