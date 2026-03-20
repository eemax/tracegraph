import { toast } from 'svelte-sonner';
import type { NormalizedEvent, SourceStatus, SseEnvelope } from '@tracegraph/shared';
import { connectEventStream, fetchEvents, fetchTraceEvents } from '$lib/api';
import { buildTraceTimeline, type TimelineItem } from '$lib/ui';
import { defaultClientEventCap, IncrementalEventIndex } from './explorer-index';
import { RequestVersion } from './request-version';

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'disconnected';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

function toSourceRecord(sources: SourceStatus[]): Record<string, SourceStatus> {
  return Object.fromEntries(sources.map((status) => [status.sourceId, status]));
}

export class ExplorerDataState {
  events = $state<NormalizedEvent[]>([]);
  nextCursor = $state<string | null>(null);
  total = $state(0);
  dropped = $state(0);
  loading = $state(false);
  loadingMore = $state(false);
  sources = $state<Record<string, SourceStatus>>({});

  traceGroupEvents = $state<NormalizedEvent[]>([]);
  traceGroupId = $state<string | null>(null);

  traceTimeline = $state<TimelineItem[]>([]);
  currentTraceRequest = $state<string | null>(null);

  connectionState = $state<ConnectionState>('connecting');
  errorMessage = $state<string | null>(null);

  sourceList = $derived(Object.values(this.sources));

  liveLabel = $derived(
    this.connectionState === 'live'
      ? 'Live'
      : this.connectionState === 'connecting'
        ? 'Connecting'
        : this.connectionState === 'reconnecting'
          ? 'Reconnecting'
          : 'Disconnected'
  );

  private eventSource: EventSource | null = null;
  private readonly eventIndex: IncrementalEventIndex;
  private readonly eventsRequestVersion = new RequestVersion();
  private appendQueue: NormalizedEvent[] = [];
  private appendFlushScheduled = false;

  constructor(eventCap = defaultClientEventCap) {
    this.eventIndex = new IncrementalEventIndex(eventCap);
  }

  getEventById(id: string): NormalizedEvent | undefined {
    return this.eventIndex.getById(id);
  }

  async start(): Promise<void> {
    this.startStream();
  }

  stop(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.connectionState = 'disconnected';
  }

  reconnectStream(): void {
    this.startStream();
  }

  async retryList(): Promise<void> {
    await this.fetchEvents(null, false);
  }

  async fetchEvents(cursor?: string | null, append = false): Promise<void> {
    const requestId = this.eventsRequestVersion.next();

    if (append) {
      this.loadingMore = true;
    } else {
      this.loading = true;
    }

    try {
      const payload = await fetchEvents(cursor);
      if (!this.eventsRequestVersion.isCurrent(requestId)) {
        return;
      }

      if (append) {
        this.eventIndex.merge(payload.items);
      } else {
        this.eventIndex.replace(payload.items);
      }

      this.events = this.eventIndex.toArray();
      this.nextCursor = payload.nextCursor;
      this.total = payload.total;
      this.dropped = payload.dropped;
      this.errorMessage = null;
    } catch (error) {
      if (!this.eventsRequestVersion.isCurrent(requestId)) {
        return;
      }

      const message = getErrorMessage(error);
      this.errorMessage = message;
      toast.error('Failed to load events', {
        description: message
      });
    } finally {
      if (!this.eventsRequestVersion.isCurrent(requestId)) {
        return;
      }

      this.loading = false;
      this.loadingMore = false;
    }
  }

  async fetchTraceGroupEvents(traceId: string | null): Promise<void> {
    if (!traceId) {
      this.traceGroupEvents = [];
      this.traceGroupId = null;
      return;
    }

    this.traceGroupId = traceId;

    try {
      const allItems: NormalizedEvent[] = [];
      let cursor: string | null = null;

      do {
        const payload = await fetchTraceEvents(traceId, cursor, 1000);

        if (this.traceGroupId !== traceId) return;

        allItems.push(...payload.items);
        cursor = payload.nextCursor;
      } while (cursor);

      if (this.traceGroupId !== traceId) return;

      this.traceGroupEvents = allItems;
    } catch (error) {
      if (this.traceGroupId === traceId) {
        this.traceGroupEvents = [];
      }

      const message = getErrorMessage(error);
      toast.error('Failed to load trace events', { description: message });
    }
  }

  async syncTraceTimeline(traceId: string | null): Promise<void> {
    if (!traceId) {
      this.traceTimeline = [];
      this.currentTraceRequest = null;
      return;
    }

    if (traceId === this.currentTraceRequest) {
      return;
    }

    this.currentTraceRequest = traceId;

    try {
      const allTraceItems: NormalizedEvent[] = [];
      let cursor: string | null = null;

      do {
        const payload = await fetchTraceEvents(traceId, cursor, 1000);

        if (this.currentTraceRequest !== traceId) {
          return;
        }

        allTraceItems.push(...payload.items);
        cursor = payload.nextCursor;
      } while (cursor);

      if (this.currentTraceRequest !== traceId) {
        return;
      }

      this.traceTimeline = buildTraceTimeline(allTraceItems);
      this.errorMessage = null;
    } catch (error) {
      if (this.currentTraceRequest === traceId) {
        this.traceTimeline = [];
      }

      const message = getErrorMessage(error);
      this.errorMessage = message;
      toast.error('Failed to load trace timeline', {
        description: message
      });
    }
  }

  ingestEnvelope(envelope: SseEnvelope): void {
    if (envelope.type === 'snapshot') {
      this.eventIndex.replace(envelope.payload.items);
      this.events = this.eventIndex.toArray();
      this.total = envelope.payload.total;
      this.dropped = envelope.payload.dropped;
      this.sources = toSourceRecord(envelope.payload.sources);
      return;
    }

    if (envelope.type === 'source_status') {
      const existing = this.sources[envelope.payload.sourceId];
      if (existing && JSON.stringify(existing) === JSON.stringify(envelope.payload)) {
        return;
      }

      this.sources = {
        ...this.sources,
        [envelope.payload.sourceId]: envelope.payload
      };
      return;
    }

    this.appendQueue.push(envelope.payload);
    this.total += 1;
    this.scheduleAppendFlush();
  }

  private scheduleAppendFlush(): void {
    if (this.appendFlushScheduled) {
      return;
    }

    this.appendFlushScheduled = true;

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.flushAppendQueue());
    } else {
      setTimeout(() => this.flushAppendQueue(), 16);
    }
  }

  private flushAppendQueue(): void {
    this.appendFlushScheduled = false;

    if (this.appendQueue.length === 0) {
      return;
    }

    const batch = this.appendQueue;
    this.appendQueue = [];
    this.eventIndex.merge(batch);
    this.events = this.eventIndex.toArray();
  }

  private startStream(): void {
    this.eventSource?.close();
    this.connectionState = 'connecting';

    this.eventSource = connectEventStream({
      onEnvelope: (envelope) => {
        this.ingestEnvelope(envelope);
      },
      onOpen: () => {
        this.connectionState = 'live';
      },
      onError: () => {
        this.connectionState = this.eventSource?.readyState === EventSource.CLOSED ? 'disconnected' : 'reconnecting';
      },
      onParseError: (error) => {
        const message = getErrorMessage(error);
        this.errorMessage = `Failed to parse SSE message: ${message}`;
        toast.error('Malformed SSE payload', {
          description: message
        });
      }
    });
  }
}
