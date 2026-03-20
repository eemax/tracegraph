# Tracegraph

Tracing tool for observability mode in [agent-commander](https://github.com/eemax/agent-commander). Ingests JSONL log files, indexes up to 100k events in memory, and serves a terminal-style trace explorer UI.

## Stack

- Runtime: Bun
- API: Elysia
- UI: SvelteKit
- Shared contracts: `packages/shared`

## Quick start

```bash
bun install
bun run dev
```

- UI: http://127.0.0.1:51739
- API: http://127.0.0.1:48292/api/health

## Configuration

Edit `tracegraph.config.yaml` to point at your JSONL log files:

```yaml
server:
  host: 0.0.0.0
  port: 48292
sources:
  - id: telegram-main
    label: Telegram Main Flow
    path: ~/agent-commander/.agent-commander/observability.jsonl
    color: '#56d364'
```

See [docs/config.md](docs/config.md) for full reference.

## Docs

- [AGENTS.md](AGENTS.md) — agent working conventions
- [docs/architecture.md](docs/architecture.md) — system design and data flow
- [docs/config.md](docs/config.md) — configuration reference
- [docs/testing.md](docs/testing.md) — test structure and matrix
- [docs/user-guide.md](docs/user-guide.md) — UI usage guide
