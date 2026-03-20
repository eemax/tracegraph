# Tracegraph

Tracing tool for observability mode in [agent-commander](https://github.com/eemax/agent-commander). Ingests JSONL log files, indexes up to 100k events in memory, serves a terminal-style trace explorer UI over SSE.

## First commands

```bash
bun install
bun run test
bun run dev
```

- UI: http://127.0.0.1:51739
- API: http://127.0.0.1:48292/api/health

## Monorepo layout

```
apps/server/       Elysia API + log ingestion + SSE fanout
apps/web/          SvelteKit frontend (explorer + inspector)
packages/shared/   Shared TypeScript interfaces (@tracegraph/shared)
tracegraph.config.yaml   Source configuration
```

## Data flow

1. Server loads `tracegraph.config.yaml` (override: `TRACEGRAPH_CONFIG` env var).
2. `LogIngestionService` tails configured JSONL files.
3. Lines are normalized into `NormalizedEvent` and inserted into a 100k ring buffer (`EventStore`).
4. `SseHub` fans out `append` and `source_status` envelopes to connected clients.
5. UI receives `snapshot` on connect, then live SSE updates.

## Editing boundaries

| Area | Paths |
|------|-------|
| Backend logic | `apps/server/src/lib/*` |
| Frontend | `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/*` |
| Shared contracts | `packages/shared/src/index.ts` |
| Config model | `tracegraph.config.yaml`, `apps/server/src/lib/config.ts` |

## High-risk areas

- **Log tailing** — truncation/rotation recovery in `apps/server/src/lib/log-ingestion.ts`. Covered by integration tests but edge cases exist under extreme write frequency.
- **Cursor pagination** — sequence-based cursor logic in `apps/server/src/lib/event-store.ts`. Off-by-one errors break the explorer.
- **SSE envelope shape** — `snapshot`, `append`, `source_status` payloads in `apps/server/src/lib/sse-hub.ts`. Frontend depends on exact shape.

## Testing

```bash
bun run test            # unit + integration (server + web)
bun run test:unit       # normalize, event-store, ui helpers
bun run test:integration # log-ingestion, api (cursor, SSE)
bun run test:e2e        # Playwright smoke
bun run test:all        # everything
```

Tests live alongside their code:
- `apps/server/test/` — unit + integration
- `apps/web/src/lib/*.test.ts` — UI helper unit tests
- `apps/web/e2e/` — Playwright E2E
- `tests/fixtures/` — shared JSONL fixtures

## API surface

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health check |
| `GET /api/sources` | List configured sources + status |
| `GET /api/events` | Paginated event query (cursor, limit, filters) |
| `GET /api/events/:id` | Single event by ID |
| `GET /api/stream` | SSE stream (snapshot, append, source_status) |

Query params for `/api/events`: `cursor`, `limit`, `from`, `to`, `eventType`, `event`, `stage`, `origin`, `traceId`, `chatId`, `q`.

## Config

Config file: `tracegraph.config.yaml` (searched in `.`, `..`, `../..`; override with `TRACEGRAPH_CONFIG`).

```yaml
server:
  host: 0.0.0.0    # default
  port: 48292        # default
sources:
  - id: telegram-main
    label: Telegram Main Flow
    path: ~/agent-commander/.agent-commander/observability.jsonl
    color: '#56d364'
```

Path values support absolute, relative (to config dir), and `~/...` expansion.

## Validation checklist

Before any handoff, verify:

1. `bun run test` passes
2. `bun run build` passes
3. `curl http://127.0.0.1:48292/api/health` returns `{"ok":true}`

## Open work

- Expand E2E beyond smoke (filters, trace timeline, SSE live append)
- Performance assertions for 100k fixture ingest
- CI workflow for test + build matrix
- SSE backpressure / reconnect storm testing
