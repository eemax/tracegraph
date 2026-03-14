import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'bun:test';
import { createServer } from '../src/lib/http';
import { withTempDir, createConfig, makeEvent } from './helpers';

function parseSseChunk(chunk: string) {
  const lines = chunk.split('\n');
  const dataLine = lines.find((line) => line.startsWith('data: '));
  if (!dataLine) {
    return null;
  }
  return JSON.parse(dataLine.slice(6));
}

describe('HTTP API integration', () => {
  it('provides cursor pagination and multi-source ordering', async () => {
    await withTempDir('observe-graph-api-', async (dir) => {
      const sourceAPath = path.join(dir, 'a.jsonl');
      const sourceBPath = path.join(dir, 'b.jsonl');
      await writeFile(sourceAPath, '', 'utf8');
      await writeFile(sourceBPath, '', 'utf8');

      const configPath = await createConfig(dir, sourceAPath, [{ id: 'source-b', label: 'Source B', path: sourceBPath }]);
      const server = await createServer({ configPath, autoStartIngestion: false });

      server.store.add(makeEvent(1, { sourceId: 'source-a', sourceLabel: 'Source A', event: 'a-1' }));
      server.store.add(makeEvent(2, { sourceId: 'source-b', sourceLabel: 'Source B', event: 'b-1' }));
      server.store.add(makeEvent(3, { sourceId: 'source-a', sourceLabel: 'Source A', event: 'a-2' }));

      const firstResponse = await server.app.handle(new Request('http://localhost/api/events?limit=2'));
      const firstData = await firstResponse.json();

      expect(firstData.items.map((item: { seq: number }) => item.seq)).toEqual([3, 2]);
      expect(firstData.nextCursor).toBe('2');

      const secondResponse = await server.app.handle(
        new Request(`http://localhost/api/events?limit=2&cursor=${firstData.nextCursor}`)
      );
      const secondData = await secondResponse.json();

      expect(secondData.items.map((item: { seq: number }) => item.seq)).toEqual([1]);
    });
  });

  it('streams snapshot on connect and append events to SSE clients', async () => {
    await withTempDir('observe-graph-sse-', async (dir) => {
      const sourcePath = path.join(dir, 'source.jsonl');
      await writeFile(sourcePath, '', 'utf8');

      const configPath = await createConfig(dir, sourcePath);
      const server = await createServer({ configPath, autoStartIngestion: false });

      server.store.add(makeEvent(1, { event: 'seed-event' }));

      const abortController = new AbortController();
      const response = await server.app.handle(
        new Request('http://localhost/api/stream', {
          signal: abortController.signal
        })
      );

      expect(response.status).toBe(200);

      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      const decoder = new TextDecoder();
      const firstRead = await reader!.read();
      const snapshot = parseSseChunk(decoder.decode(firstRead.value));

      expect(snapshot?.type).toBe('snapshot');
      expect(snapshot?.payload.items[0].event).toBe('seed-event');

      server.hub.publish({ type: 'append', payload: makeEvent(2, { event: 'live-event' }) });
      const secondRead = await reader!.read();
      const append = parseSseChunk(decoder.decode(secondRead.value));

      expect(append?.type).toBe('append');
      expect(append?.payload.event).toBe('live-event');

      abortController.abort();

      const reconnect = await server.app.handle(new Request('http://localhost/api/stream'));
      const reconnectReader = reconnect.body?.getReader();
      const reconnectRead = await reconnectReader!.read();
      const reconnectSnapshot = parseSseChunk(decoder.decode(reconnectRead.value));

      expect(reconnectSnapshot?.type).toBe('snapshot');
      expect(Array.isArray(reconnectSnapshot?.payload.items)).toBe(true);
    });
  });
});
