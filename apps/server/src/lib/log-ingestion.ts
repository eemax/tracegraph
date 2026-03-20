import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { SourceStatus } from '@tracegraph/shared';
import type { TracegraphConfig } from './config';
import { EventStore } from './event-store';
import { normalizeEvent } from './normalize';
import { SseHub } from './sse-hub';

interface SourceRuntime {
  source: TracegraphConfig['sources'][number];
  status: SourceStatus;
  offset: number;
  line: number;
  remainder: string;
  remainderOffset: number;
  identity: string | null;
  idleRemainderPolls: number;
  lastStatusSignature: string;
}

function getFileIdentity(stats: Awaited<ReturnType<typeof stat>>): string {
  return `${stats.dev}:${stats.ino}`;
}

async function readRangeUtf8(filePath: string, start: number, endExclusive: number): Promise<string> {
  if (endExclusive <= start) {
    return '';
  }

  const stream = createReadStream(filePath, {
    encoding: 'utf8',
    start,
    end: endExclusive - 1
  });

  let output = '';
  for await (const chunk of stream) {
    output += chunk;
  }
  return output;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function stripUtf8Bom(input: string): string {
  return input.startsWith('\uFEFF') ? input.slice(1) : input;
}

export class LogIngestionService {
  private readonly store: EventStore;

  private readonly hub: SseHub;

  private readonly runtimes: SourceRuntime[];

  private readonly pollMs: number;

  private timer: Timer | null = null;

  private pollInFlight = false;

  private seq = 1;

  constructor(config: TracegraphConfig, store: EventStore, hub: SseHub, pollMs = 1000) {
    this.store = store;
    this.hub = hub;
    this.pollMs = pollMs;

    this.runtimes = config.sources.map((source) => ({
      source,
      status: {
        sourceId: source.id,
        healthy: false,
        watching: false,
        lastReadAt: null,
        malformedLines: 0,
        totalLines: 0,
        error: 'Not started'
      },
      offset: 0,
      line: 0,
      remainder: '',
      remainderOffset: 0,
      identity: null,
      idleRemainderPolls: 0,
      lastStatusSignature: ''
    }));
  }

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    for (const runtime of this.runtimes) {
      runtime.status.watching = true;
      runtime.status.error = undefined;
      this.emitStatus(runtime, true);
    }

    await this.pollOnce();
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, this.pollMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    for (const runtime of this.runtimes) {
      runtime.status.watching = false;
      runtime.status.error = runtime.status.error ?? 'Stopped';
      this.emitStatus(runtime, true);
    }
  }

  async pollOnce(): Promise<void> {
    if (this.pollInFlight) {
      return;
    }

    this.pollInFlight = true;
    try {
      await Promise.allSettled(this.runtimes.map((runtime) => this.tickRuntime(runtime)));
    } finally {
      this.pollInFlight = false;
    }
  }

  getStatuses(): SourceStatus[] {
    return this.runtimes.map((runtime) => ({ ...runtime.status }));
  }

  private async tickRuntime(runtime: SourceRuntime): Promise<void> {
    try {
      const stats = await stat(runtime.source.resolvedPath);
      const identity = getFileIdentity(stats);

      if (runtime.identity && runtime.identity !== identity) {
        this.resetRuntime(runtime);
      } else if (stats.size < runtime.offset) {
        this.resetRuntime(runtime);
      }

      runtime.identity = identity;

      const previousOffset = runtime.offset;
      const nextOffset = stats.size;

      let consumed = false;

      if (nextOffset > previousOffset) {
        const chunk = await readRangeUtf8(runtime.source.resolvedPath, previousOffset, nextOffset);
        this.processChunk(runtime, chunk, previousOffset);
        runtime.offset = nextOffset;
        runtime.idleRemainderPolls = 0;
        consumed = true;
      } else if (runtime.remainder.length > 0) {
        runtime.idleRemainderPolls += 1;
        if (runtime.idleRemainderPolls >= 2) {
          this.flushTrailingRemainder(runtime, nextOffset);
          consumed = true;
        }
      }

      const healthChanged = !runtime.status.healthy || runtime.status.error !== undefined;
      runtime.status.healthy = true;
      runtime.status.error = undefined;

      if (consumed || healthChanged) {
        runtime.status.lastReadAt = new Date().toISOString();
      }

      this.emitStatus(runtime);
    } catch (error) {
      runtime.status.healthy = false;
      runtime.status.error = getErrorMessage(error);
      runtime.status.lastReadAt = new Date().toISOString();
      this.emitStatus(runtime);
    }
  }

  private processChunk(runtime: SourceRuntime, chunk: string, offset: number): void {
    const combined = runtime.remainder.length > 0 ? `${runtime.remainder}${chunk}` : chunk;
    const fullLines = combined.split('\n');
    const remainder = fullLines.pop() ?? '';

    let lineOffset = runtime.remainder.length > 0 ? runtime.remainderOffset : offset;

    for (const line of fullLines) {
      const lineBytes = Buffer.byteLength(`${line}\n`, 'utf8');
      this.ingestLine(runtime, line, lineOffset);
      lineOffset += lineBytes;
    }

    runtime.remainder = remainder;
    runtime.remainderOffset = lineOffset;
    runtime.idleRemainderPolls = 0;
  }

  private flushTrailingRemainder(runtime: SourceRuntime, fileSize: number): void {
    const content = stripUtf8Bom(runtime.remainder).trim();

    if (content.length === 0) {
      runtime.remainder = '';
      runtime.remainderOffset = fileSize;
      runtime.idleRemainderPolls = 0;
      return;
    }

    // Avoid parsing likely-incomplete writes that have no newline yet.
    if (!(content.startsWith('{') && content.endsWith('}'))) {
      return;
    }

    this.ingestLine(runtime, runtime.remainder, runtime.remainderOffset);
    runtime.remainder = '';
    runtime.remainderOffset = fileSize;
    runtime.idleRemainderPolls = 0;
  }

  private ingestLine(runtime: SourceRuntime, rawLine: string, offset: number): void {
    runtime.line += 1;
    runtime.status.totalLines += 1;

    const content = stripUtf8Bom(rawLine).trim();
    if (content.length === 0) {
      return;
    }

    try {
      const parsed = JSON.parse(content);
      const event = normalizeEvent(parsed, {
        id: `${runtime.source.id}:${this.seq}`,
        seq: this.seq,
        sourceId: runtime.source.id,
        sourceLabel: runtime.source.label,
        line: runtime.line,
        offset,
        ingestedAt: new Date().toISOString()
      });

      if (!event) {
        runtime.status.malformedLines += 1;
        return;
      }

      this.store.add(event);
      this.hub.publish({
        type: 'append',
        payload: event
      });
      this.seq += 1;
    } catch {
      runtime.status.malformedLines += 1;
    }
  }

  private emitStatus(runtime: SourceRuntime, force = false): void {
    const { lastReadAt: _, ...stable } = runtime.status;
    const signature = JSON.stringify(stable);
    if (!force && signature === runtime.lastStatusSignature) {
      return;
    }

    runtime.lastStatusSignature = signature;

    this.hub.publish({
      type: 'source_status',
      payload: { ...runtime.status }
    });
  }

  private resetRuntime(runtime: SourceRuntime): void {
    runtime.offset = 0;
    runtime.line = 0;
    runtime.remainder = '';
    runtime.remainderOffset = 0;
    runtime.idleRemainderPolls = 0;
  }
}
