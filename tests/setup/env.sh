#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export TRACEGRAPH_ROOT="$ROOT_DIR"
export TRACEGRAPH_TEST_FIXTURES="$ROOT_DIR/tests/fixtures"
export TRACEGRAPH_TEST_TMP="$ROOT_DIR/tests/tmp"
export TRACEGRAPH_TEST_RESULTS="$ROOT_DIR/tests/results"

mkdir -p "$TRACEGRAPH_TEST_TMP" "$TRACEGRAPH_TEST_RESULTS"
