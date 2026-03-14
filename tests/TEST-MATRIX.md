# Test Matrix

## Unit

- `apps/server/test/normalize.test.ts`
  - valid event normalization
  - non-object rejection
- `apps/server/test/event-store.test.ts`
  - filter combinations
  - search behavior
  - ring buffer/dropped behavior
- `apps/web/src/lib/ui.test.ts`
  - query string generation
  - client-side filter matching
  - trace timeline depth logic

## Integration

- `apps/server/test/log-ingestion.test.ts`
  - append ingestion
  - truncation recovery
  - rotation recovery
  - malformed line handling
- `apps/server/test/api.test.ts`
  - cursor pagination
  - multi-source ordering
  - SSE snapshot/append/reconnect behavior

## E2E

- `apps/web/e2e/smoke.spec.ts`
  - app renders
  - explorer rows visible
  - inspector interaction

## Planned Extensions

- source-path permission failure handling
- very large fixture ingest (100k+ events) latency assertions
- SSE backpressure / reconnect storm test
- visual regression snapshots for explorer/inspector panes
