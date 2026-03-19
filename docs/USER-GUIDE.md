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

3. Open UI at `http://127.0.0.1:5173`.

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

- Filter by `event`, `stage`, `origin`, `traceId`, `chatId`.
- Use `Search` for full-text query on raw event payload JSON.
- Click `Apply` to run filters and `Reset` to clear all fields.
- Switch group mode between `Types` and `Traces` in the group sidebar.
- Arrow keys move selection in the explorer list.
- Desktop layout uses draggable panes:
  - outer split: Event Feed vs Event Inspector
  - inner split: Group Sidebar vs Event List
- Mobile layout keeps inspector visible and opens groups from the `Groups` sheet button.
- Inspector tabs:
  - `Parsed`: important structured fields.
  - `Raw JSON`: full event payload.
  - `Trace Timeline`: ordered events for the active trace.
- Connection state badge shows `Connecting`, `Live`, `Reconnecting`, or `Disconnected`.

## Useful Endpoints

- `http://127.0.0.1:4317/api/health`
- `http://127.0.0.1:4317/api/sources`
- `http://127.0.0.1:4317/api/events?limit=50`
