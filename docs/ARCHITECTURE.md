# Architecture

## Overview

Tracegraph is a Bun monorepo with three major packages:

- `apps/server`: Elysia API + log ingestion + SSE fanout.
- `apps/web`: SvelteKit frontend for explorer/inspector UI.
- `packages/shared`: shared TypeScript interfaces for API payloads and events.

## Web UI Module Layout

The web explorer is now split into state orchestration, API helpers, and focused feature components:

```text
apps/web/src/
  app.css
  routes/
    +layout.svelte
    +page.svelte
  lib/
    api.ts
    ui.ts
    state/
      explorer.svelte.ts
    components/
      explorer/
        ExplorerShell.svelte
        TopbarStats.svelte
        FilterPanel.svelte
        SourceStatusStrip.svelte
        GroupSidebar.svelte
        EventVirtualList.svelte
        InspectorPanel.svelte
      ui/
        ...shadcn-svelte primitives...
```

- `lib/state/explorer.svelte.ts` owns runtime behavior (filters, paging, SSE, selection, virtualization, inspector tab/trace loading).
- `lib/api.ts` is the thin boundary for `/api/events` and `/api/stream`.
- `routes/+page.svelte` is composition-only and mounts `ExplorerShell`.

## Data Flow

1. Server loads `tracegraph.config.yaml`.
2. `LogIngestionService` tails configured JSONL files.
3. Each valid line is normalized into `NormalizedEvent`.
4. Events are inserted into a 100k-capacity ring store (`EventStore`).
5. `SseHub` publishes `append` and `source_status` envelopes.
6. UI receives initial `snapshot` + ongoing SSE updates.
7. Explorer and inspector render filtered event state.

On the client:

1. `ExplorerState.start()` loads initial events (`/api/events`) and opens SSE (`/api/stream`).
2. SSE `snapshot`/`append`/`source_status` envelopes update state in-place.
3. Derived state computes groups, selected event, virtual list window, and inspector payload.
4. Explorer components render from one-way state reads and call state methods for mutations.

## Storage and Indexing

- In-memory ring buffer (capacity: 100,000).
- Secondary indexes for:
  - `event`
  - `stage`
  - `trace.origin`
  - `trace.traceId`
  - `chatId`
- Lowercased raw JSON text cache per event for `q` filtering.

## API Surface

- `GET /api/health`
- `GET /api/sources`
- `GET /api/events`
- `GET /api/events/:id`
- `GET /api/stream` (SSE)

## Runtime Topology

- Dev: `apps/server` and `apps/web` run as separate processes.
- Prod: Elysia serves API + static build output from `apps/web/build`.
