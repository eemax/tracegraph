import path from 'node:path';
import { appendFile, rename, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'bun:test';
import { EventStore } from '../src/lib/event-store';
import { LogIngestionService } from '../src/lib/log-ingestion';
import { SseHub } from '../src/lib/sse-hub';
import type { TracegraphConfig } from '../src/lib/config';
import { withTempDir } from './helpers';

describe('LogIngestionService', () => {
  it('handles append, truncate, and rotation without crashing', async () => {
    await withTempDir('tracegraph-ingestion-', async (dir) => {
      const logPath = path.join(dir, 'logs.jsonl');
      await writeFile(
        logPath,
        '{"timestamp":"2026-03-13T03:46:49.053Z","event":"first"}\n{"timestamp":"2026-03-13T03:46:49.060Z","event":"second"}\n',
        'utf8'
      );

      const config: TracegraphConfig = {
        server: { host: '0.0.0.0', port: 48292 },
        sources: [
          {
            id: 'source-a',
            label: 'Source A',
            path: logPath,
            resolvedPath: logPath
          }
        ]
      };

      const store = new EventStore(1000);
      const hub = new SseHub();
      const ingestion = new LogIngestionService(config, store, hub, 60_000);

      await ingestion.pollOnce();
      expect(store.size).toBe(2);

      await appendFile(logPath, '{"timestamp":"2026-03-13T03:46:49.061Z","event":"third"}\n', 'utf8');
      await ingestion.pollOnce();
      expect(store.size).toBe(3);

      await writeFile(logPath, '{"timestamp":"2026-03-13T03:46:49.062Z","event":"post-truncate"}\n', 'utf8');
      await ingestion.pollOnce();
      expect(store.query({ limit: 10 }).items.some((event) => event.event === 'post-truncate')).toBe(true);

      await rename(logPath, `${logPath}.1`);
      await writeFile(logPath, '{"timestamp":"2026-03-13T03:46:49.063Z","event":"post-rotate"}\n', 'utf8');
      await ingestion.pollOnce();
      expect(store.query({ limit: 10 }).items.some((event) => event.event === 'post-rotate')).toBe(true);

      const statuses = ingestion.getStatuses();
      expect(statuses[0]?.healthy).toBe(true);
    });
  });

  it('increments malformed line stats and keeps processing', async () => {
    await withTempDir('tracegraph-ingestion-', async (dir) => {
      const logPath = path.join(dir, 'logs.jsonl');
      await writeFile(logPath, 'not-json\n{"timestamp":"2026-03-13T03:46:49.060Z","event":"ok"}\n', 'utf8');

      const config: TracegraphConfig = {
        server: { host: '0.0.0.0', port: 48292 },
        sources: [
          {
            id: 'source-a',
            label: 'Source A',
            path: logPath,
            resolvedPath: logPath
          }
        ]
      };

      const store = new EventStore(1000);
      const hub = new SseHub();
      const ingestion = new LogIngestionService(config, store, hub, 60_000);

      await ingestion.pollOnce();
      const statuses = ingestion.getStatuses();

      expect(store.size).toBe(1);
      expect(statuses[0]?.malformedLines).toBe(1);
      expect(statuses[0]?.totalLines).toBe(2);
    });
  });

  it('parses a trailing JSON line without newline after idle polls', async () => {
    await withTempDir('tracegraph-ingestion-', async (dir) => {
      const logPath = path.join(dir, 'logs.jsonl');
      await writeFile(
        logPath,
        '{"timestamp":"2026-03-13T14:21:45.229Z","event":"telegram.outbound.draft.sent","text":"⏳ [10s] say ”hello”"}',
        'utf8'
      );

      const config: TracegraphConfig = {
        server: { host: '0.0.0.0', port: 48292 },
        sources: [
          {
            id: 'source-a',
            label: 'Source A',
            path: logPath,
            resolvedPath: logPath
          }
        ]
      };

      const store = new EventStore(1000);
      const hub = new SseHub();
      const ingestion = new LogIngestionService(config, store, hub, 60_000);

      await ingestion.pollOnce();
      expect(store.size).toBe(0);

      await ingestion.pollOnce();
      await ingestion.pollOnce();

      expect(store.size).toBe(1);
      expect(store.query({ limit: 10 }).items.some((event) => event.event === 'telegram.outbound.draft.sent')).toBe(
        true
      );
    });
  });
});
