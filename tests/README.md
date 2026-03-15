# Testing Scaffold

This directory is the centralized test harness for Tracegraph.

## Goals

- Keep tests discoverable by test type.
- Keep reusable fixtures and scripts in one place.
- Support local and CI execution with predictable commands.

## Structure

- `fixtures/`: JSONL fixtures for parser, rotation, malformed lines, and load tests.
- `setup/`: shared environment and path helpers for scripts/tests.
- `scripts/`: orchestration scripts (unit, integration, e2e, all).
- `load/`: fixture generators for scale tests.
- `smoke/`: lightweight runtime checks.
- `tmp/`: ephemeral files during local test runs (gitignored).
- `results/`: optional test artifacts/logs (gitignored).

## Canonical Commands

From repo root:

```bash
bun run test:unit
bun run test:integration
bun run test:e2e
bun run test:all
```

Or via scripts:

```bash
bash tests/scripts/run-unit.sh
bash tests/scripts/run-integration.sh
bash tests/scripts/run-e2e.sh
bash tests/scripts/run-all.sh
```

## Notes

- Unit + integration tests live in `apps/server/test` and `apps/web/src/lib/*.test.ts`.
- Playwright E2E tests live in `apps/web/e2e`.
- Fixture files in `tests/fixtures` are the source of truth for future test expansion.
