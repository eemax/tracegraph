# User Guide

## Start the App

1. Install dependencies:

```bash
bun install
```

2. Start both API and UI:

```bash
bun run dev
```

3. Open UI at `http://127.0.0.1:51739`.

## Configure Log Sources

Edit `tracegraph.config.yaml` and set each source path to a JSONL file.

Example:

```yaml
sources:
  - id: telegram-main
    label: Telegram Main Flow
    path: ~/agent-commander/.agent-commander/observability.jsonl
    color: '#56d364'
```

`~` paths are supported.

## Use the UI

- Feed rows are shown in ascending chronological order (`oldest -> newest`).
- Group sidebar shows trace groups and counts, but does not hide events from the main feed.
- Arrow keys move selection in the explorer list and keep the selected row visible.
- `Enter` opens or focuses inspector context for the selected row.
- Inline explorer error banner includes `Retry list` and `Reconnect stream`.
- Desktop layout uses draggable panes:
  - outer split: Event Feed vs Event Inspector
  - inner split: Group Sidebar vs Event List
- Mobile layout is feed-first; selecting an event opens inspector in a bottom sheet.
- Mobile groups remain available through the `Groups` sheet button.
- Inspector tabs:
  - `Parsed`: important structured fields.
  - `Raw JSON`: full event payload.
  - `Trace Timeline`: ordered events for the active trace.
- Top status row shows global counters (`Total`, `Dropped`, `Loaded`), connection badge, and per-source health badges (`healthy`/`degraded`, lines, malformed).

## Useful Endpoints

- `http://127.0.0.1:48292/api/health`
- `http://127.0.0.1:48292/api/sources`
- `http://127.0.0.1:48292/api/events?limit=50`
- `http://127.0.0.1:48292/api/traces/<traceId>/events?limit=100`
