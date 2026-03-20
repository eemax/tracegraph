import { toast } from 'svelte-sonner';
import type { NormalizedEvent, SourceStatus, SseEnvelope } from '@tracegraph/shared';
import { connectEventStream, fetchEvents, fetchTraceEvents } from '$lib/api';
import { buildTraceTimeline, eventMatchesFilters, type TimelineItem, type UiFilters } from '$lib/ui';
import {
  applyDraftFilters as applyDraftFiltersModel,
  createFilterModels,
  resetFilterModels as resetFilterModelsState,
  setDraftFilter as setDraftFilterModel
} from './explorer-filters';
import { defaultClientEventCap, IncrementalEventIndex } from './explorer-index';
import { filtersEqual, filtersHaveValues } from './explorer-selectors';

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
  draftFilters = $state<UiFilters>(createFilterModels().draftFilters);
  activeFilters = $state<UiFilters>(createFilterModels().activeFilters);

  events = $state<NormalizedEvent[]>([]);
  nextCursor = $state<string | null>(null);
  total = $state(0);
  dropped = $state(0);
  loading = $state(false);
  loadingMore = $state(false);
  sources = $state<Record<string, SourceStatus>>({});

  traceTimeline = $state<TimelineItem[]>([]);
  currentTraceRequest = $state<string | null>(null);

  connectionState = $state<ConnectionState>('connecting');
  errorMessage = $state<string | null>(null);

  sourceList = $derived(Object.values(this.sources));

  hasActiveFilters = $derived(filtersHaveValues(this.activeFilters));
  hasUnappliedFilters = $derived(!filtersEqual(this.draftFilters, this.activeFilters));

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

  constructor(eventCap = defaultClientEventCap) {
    this.eventIndex = new IncrementalEventIndex(eventCap);
  }

  setDraftFilter(key: keyof UiFilters, value: string): void {
    const nextModels = setDraftFilterModel(
      { draftFilters: this.draftFilters, activeFilters: this.activeFilters },
      key,
      value
    );
    this.draftFilters = nextModels.draftFilters;
  }

  applyDraftFilters(): void {
    const nextModels = applyDraftFiltersModel({
      draftFilters: this.draftFilters,
      activeFilters: this.activeFilters
    });
    this.activeFilters = nextModels.activeFilters;
  }

  resetFilterModels(): void {
    const nextModels = resetFilterModelsState();
    this.draftFilters = nextModels.draftFilters;
    this.activeFilters = nextModels.activeFilters;
  }

  async start(): Promise<void> {
    await this.fetchEvents(null, false);
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
    if (append) {
      this.loadingMore = true;
    } else {
      this.loading = true;
    }

    try {
      const payload = await fetchEvents(this.activeFilters, cursor);

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
      const message = getErrorMessage(error);
      this.errorMessage = message;
      toast.error('Failed to load events', {
        description: message
      });
    } finally {
      this.loading = false;
      this.loadingMore = false;
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
      const payload = await fetchTraceEvents(this.activeFilters, traceId);

      if (this.currentTraceRequest !== traceId) {
        return;
      }

      this.traceTimeline = buildTraceTimeline(payload.items);
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
      const visibleItems = envelope.payload.items.filter((event) => eventMatchesFilters(event, this.activeFilters));
      this.eventIndex.merge(visibleItems);
      this.events = this.eventIndex.toArray();
      this.total = Math.max(this.total, envelope.payload.total);
      this.dropped = Math.max(this.dropped, envelope.payload.dropped);
      this.sources = toSourceRecord(envelope.payload.sources);
      return;
    }

    if (envelope.type === 'source_status') {
      this.sources = {
        ...this.sources,
        [envelope.payload.sourceId]: envelope.payload
      };
      return;
    }

    if (!eventMatchesFilters(envelope.payload, this.activeFilters)) {
      return;
    }

    this.eventIndex.upsert(envelope.payload);
    this.events = this.eventIndex.toArray();
    this.total += 1;
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
