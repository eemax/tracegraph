# Architecture

## Overview

Observe Graph is a Bun monorepo with three major packages:

- `apps/server`: Elysia API + log ingestion + SSE fanout.
- `apps/web`: SvelteKit frontend for explorer/inspector UI.
- `packages/shared`: shared TypeScript interfaces for API payloads and events.

## Data Flow

1. Server loads `observe-graph.config.yaml`.
2. `LogIngestionService` tails configured JSONL files.
3. Each valid line is normalized into `NormalizedEvent`.
4. Events are inserted into a 100k-capacity ring store (`EventStore`).
5. `SseHub` publishes `append` and `source_status` envelopes.
6. UI receives initial `snapshot` + ongoing SSE updates.
7. Explorer and inspector render filtered event state.

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
