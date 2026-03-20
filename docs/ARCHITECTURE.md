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
      explorer-data.svelte.ts
      explorer-view.svelte.ts
      explorer-selectors.ts
      explorer-index.ts
      explorer-filters.ts
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

- `lib/state/explorer.svelte.ts` is a facade that wires data, view, and selector modules.
- `lib/state/explorer-data.svelte.ts` owns fetch/SSE lifecycle, source status, counters, and error surface.
- `lib/state/explorer-view.svelte.ts` owns selection, keyboard navigation, mobile sheets, and scroll/viewport state.
- `lib/state/explorer-selectors.ts` contains pure grouped/filter/window selectors.
- `lib/state/explorer-index.ts` provides incremental append indexing (`Map + orderedIds`) with a client cap.
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

1. `ExplorerState.start()` loads initial events with `activeFilters` and opens SSE (`/api/stream`).
2. Filter controls write to `draftFilters`; only `Apply` promotes `draftFilters -> activeFilters`.
3. `ExplorerDataState` ingests `snapshot`/`append`/`source_status` envelopes and updates incremental index structures.
4. `ExplorerViewState` coordinates selection, keyboard navigation, and mobile inspector/group sheets.
5. Pure selectors compute grouped views, filtered views, and virtualization windows consumed by the facade.
6. Explorer components render from facade reads and call facade methods for mutations.

## Storage and Indexing

- In-memory ring buffer (capacity: 100,000).
- Secondary indexes for:
  - `eventType`
  - `event`
  - `stage`
  - `trace.origin`
  - `trace.traceId`
  - `chatId`
- Lowercased raw JSON text cache per event for `q` filtering.

Client-side explorer indexing:

- `eventsById` map + `orderedIds` descending by `seq`.
- Incremental upsert/reposition on append updates (no full-array re-sort per append).
- Client memory cap defaults to 100,000 events.

## API Surface

- `GET /api/health`
- `GET /api/sources`
- `GET /api/events`
- `GET /api/events/:id`
- `GET /api/stream` (SSE)

## Runtime Topology

- Dev: `apps/server` and `apps/web` run as separate processes.
- Prod: Elysia serves API + static build output from `apps/web/build`.
