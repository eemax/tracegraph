# Agents README

This document defines working conventions for human/AI agents in this repository.

## Objectives

- Keep Observe Graph operable on LAN (`0.0.0.0`) with no auth for v1.
- Preserve JSONL ingestion correctness and SSE stability.
- Avoid breaking shared type contracts in `packages/shared` without coordinated updates.

## First Commands

```bash
bun install
bun run test
bun run dev
```

## Required Checks Before Handoff

1. `bun run test` passes.
2. `bun run build` passes.
3. `curl http://127.0.0.1:4317/api/health` returns `ok: true`.

## Editing Boundaries

- Backend logic: `apps/server/src/lib/*`
- Frontend behavior: `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/*`
- Shared contracts: `packages/shared/src/index.ts`
- Config model: `observe-graph.config.yaml`, `apps/server/src/lib/config.ts`

## High-Risk Areas

- Tailing/truncation/rotation behavior in `log-ingestion.ts`
- Cursor pagination semantics in `event-store.ts`
- SSE event shape and snapshot payload compatibility

## Handoff Checklist

- Update `docs/PROGRESS.log` with timestamp + summary.
- Update `docs/AGENTS-HANDOFF.md` with current status and next actions.
- Call out breaking changes to config or API routes explicitly.
