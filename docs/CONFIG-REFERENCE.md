# Config Reference

All config is loaded from `observe-graph.config.yaml` unless overridden by `OBSERVE_GRAPH_CONFIG`.

## Resolution Rules

1. If `OBSERVE_GRAPH_CONFIG` is set, that path is used.
2. Otherwise server searches:
   - `./observe-graph.config.yaml`
   - `../observe-graph.config.yaml`
   - `../../observe-graph.config.yaml`
3. Path values support:
   - absolute paths
   - relative paths (relative to config file directory)
   - `~` and `~/...` (expanded to home directory)

## Schema

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

## Options

### `server.host`

- Type: `string`
- Required: no
- Default: `0.0.0.0`
- Purpose: bind address for Elysia HTTP server.

### `server.port`

- Type: `number`
- Required: no
- Default: `4317`
- Purpose: bind port for API + static web serving.

### `sources`

- Type: `array`
- Required: yes (must contain at least one entry)
- Purpose: define JSONL log files to ingest and watch.

Each `sources[]` item:

#### `sources[].id`

- Type: `string`
- Required: yes
- Purpose: stable source identifier used in events/status payloads.

#### `sources[].label`

- Type: `string`
- Required: yes
- Purpose: display label shown in UI.

#### `sources[].path`

- Type: `string`
- Required: yes
- Purpose: filesystem path to JSONL log file.
- Supports: absolute, relative, `~`.

#### `sources[].color`

- Type: `string`
- Required: no
- Default: none
- Purpose: optional source color hint for UI.

## Environment Variables

### `OBSERVE_GRAPH_CONFIG`

- Type: `string`
- Required: no
- Purpose: explicit path to config file.

No other environment variables are currently consumed by server runtime.
