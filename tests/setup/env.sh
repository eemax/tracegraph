#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export OBSERVE_GRAPH_ROOT="$ROOT_DIR"
export OBSERVE_GRAPH_TEST_FIXTURES="$ROOT_DIR/tests/fixtures"
export OBSERVE_GRAPH_TEST_TMP="$ROOT_DIR/tests/tmp"
export OBSERVE_GRAPH_TEST_RESULTS="$ROOT_DIR/tests/results"

mkdir -p "$OBSERVE_GRAPH_TEST_TMP" "$OBSERVE_GRAPH_TEST_RESULTS"
