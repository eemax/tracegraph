#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/tests/setup/env.sh"

cd "$ROOT_DIR"
echo "[tests] running full suite (unit + integration + e2e)"
bash tests/scripts/run-unit.sh
bash tests/scripts/run-integration.sh
bash tests/scripts/run-e2e.sh
