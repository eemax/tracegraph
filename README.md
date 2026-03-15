# Tracegraph

Tracegraph is a tracing tool for observability mode in agent-commander. It ingests JSONL log files, indexes up to 100k events in memory, and exposes a terminal-inspired UI with an event explorer + event inspector.

## Stack

- Runtime: Bun
- API server: Elysia
- UI: SvelteKit (Vite)
- Shared contracts: workspace package in `packages/shared`

## Quick start

1. Install dependencies:

```bash
bun install
```

2. Run both API + UI:

```bash
bun run dev
```

Alternative split mode:

```bash
bun run dev:server
bun run dev:web
```

4. Open:

- UI: http://127.0.0.1:5173
- API health: http://127.0.0.1:4317/api/health

## Configuration

Log sources are configured in `tracegraph.config.yaml`:

```yaml
server:
  host: 0.0.0.0
  port: 4317
sources:
  - id: telegram-main
    label: Telegram Main Flow
    path: ./logs/sample-observability.jsonl
    color: '#56d364'
```

## API

- `GET /api/health`
- `GET /api/sources`
- `GET /api/events?cursor&limit&from&to&event&stage&origin&traceId&chatId&q`
- `GET /api/events/:id`
- `GET /api/stream` (SSE with `snapshot`, `append`, `source_status`)

## Build and test

```bash
bun run build
bun run test
bun run test:unit
bun run test:integration
bun run test:e2e
bun run test:all
```

## E2E smoke

Playwright smoke test scaffold is included:

```bash
bun run --cwd apps/web test:e2e
```

## Additional docs

- `docs/AGENTS-README.md`
- `docs/ARCHITECTURE.md`
- `docs/USER-GUIDE.md`
- `docs/CONFIG-REFERENCE.md`
- `docs/PROGRESS.log`
- `docs/AGENTS-HANDOFF.md`
