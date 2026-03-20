# Testing

## Commands

From repo root:

```bash
bun run test              # unit + integration (server + web)
bun run test:unit         # normalize, event-store, ui helpers
bun run test:integration  # log-ingestion, api
bun run test:e2e          # Playwright smoke
bun run test:all          # everything
bun run test:smoke        # bash API health check
```

## Test locations

- `apps/server/test/` — server unit + integration tests
- `apps/web/src/lib/*.test.ts` — UI helper unit tests
- `apps/web/src/lib/state/*.test.ts` — explorer state helper tests
- `apps/web/e2e/` — Playwright E2E tests
- `tests/fixtures/` — shared JSONL fixtures
- `tests/setup/` — shared env and path helpers
- `tests/load/` — fixture generators for scale tests
- `tests/smoke/` — lightweight runtime checks

## Test matrix

### Unit

| File | Covers |
|------|--------|
| `apps/server/test/normalize.test.ts` | Event normalization, non-object rejection |
| `apps/server/test/event-store.test.ts` | Ascending cursor pagination, trace timeline query, ring buffer overflow |
| `apps/web/src/lib/ui.test.ts` | Pagination query generation, grouping helpers, trace timeline depth |
| `apps/web/src/lib/state/explorer.test.ts` | Parsed field projection |
| `apps/web/src/lib/state/explorer-index.test.ts` | Incremental append ordering, de-dup/update, cap trimming |
| `apps/web/src/lib/state/explorer-selectors.test.ts` | Group selectors and virtualization window outputs |

### Integration

| File | Covers |
|------|--------|
| `apps/server/test/log-ingestion.test.ts` | Append ingestion, truncation recovery, rotation recovery, malformed lines |
| `apps/server/test/api.test.ts` | Ascending cursor pagination, deprecated param ignore behavior, trace endpoint, SSE snapshot/append/reconnect |

### E2E

| File | Covers |
|------|--------|
| `apps/web/e2e/smoke.spec.ts` | App render/selection, no-filter UI assertions, keyboard visibility, mobile inspector open/close retention |

### Planned

- Source-path permission failure handling
- 100k+ event ingest latency assertions
- SSE backpressure / reconnect storm
- Visual regression snapshots for explorer/inspector
