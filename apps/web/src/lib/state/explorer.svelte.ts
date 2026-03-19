import { toast } from 'svelte-sonner';
import type { NormalizedEvent, SourceStatus, SseEnvelope } from '@tracegraph/shared';
import { connectEventStream, fetchEvents, fetchTraceEvents } from '$lib/api';
import {
  buildEventTypeGroups,
  buildTraceGroups,
  buildTraceTimeline,
  eventMatchesFilters,
  getEventType,
  getTraceGroupKey,
  highlightJsonSyntax,
  toPrettyInspectorJson,
  type TimelineItem,
  type UiFilters
} from '$lib/ui';
import {
  buildParsedFields,
  createDefaultFilters,
  mergeUniqueTop
} from './explorer-helpers';

export type GroupMode = 'types' | 'traces';
export type InspectorTab = 'parsed' | 'raw' | 'trace';
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'disconnected';
export type { ParsedField };

export const allGroupsKey = '__all_groups__';
const rowHeight = 50;
const overscan = 10;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

export class ExplorerState {
  filters = $state<UiFilters>(createDefaultFilters());

  events = $state<NormalizedEvent[]>([]);
  nextCursor = $state<string | null>(null);
  total = $state(0);
  dropped = $state(0);
  loading = $state(false);
  loadingMore = $state(false);
  sources = $state<Record<string, SourceStatus>>({});

  groupingMode = $state<GroupMode>('types');
  selectedGroup = $state(allGroupsKey);
  mobileGroupsOpen = $state(false);

  selectedId = $state<string | null>(null);
  inspectorTab = $state<InspectorTab>('parsed');
  traceTimeline = $state<TimelineItem[]>([]);
  currentTraceRequest = $state<string | null>(null);

  connectionState = $state<ConnectionState>('connecting');
  errorMessage = $state<string | null>(null);

  listPane = $state<HTMLDivElement | null>(null);
  scrollTop = $state(0);
  viewportHeight = $state(520);

  private eventSource: EventSource | null = null;
  private resizeObserver: ResizeObserver | null = null;

  groups = $derived(
    this.groupingMode === 'types' ? buildEventTypeGroups(this.events) : buildTraceGroups(this.events)
  );

  filteredEvents = $derived(
    this.selectedGroup === allGroupsKey
      ? this.events
      : this.events.filter((event) => this.isEventInGroup(event, this.selectedGroup))
  );

  sourceList = $derived(Object.values(this.sources));

  selectedEvent = $derived(this.events.find((event) => event.id === this.selectedId) ?? null);

  parsedFields = $derived(this.selectedEvent ? buildParsedFields(this.selectedEvent) : []);
  rawInspectorJson = $derived(this.selectedEvent ? toPrettyInspectorJson(this.selectedEvent.raw) : '');
  highlightedRawInspectorJson = $derived(highlightJsonSyntax(this.rawInspectorJson));

  totalRows = $derived(this.filteredEvents.length);
  startIndex = $derived(Math.max(0, Math.floor(this.scrollTop / rowHeight) - overscan));
  endIndex = $derived(Math.min(this.totalRows, Math.ceil((this.scrollTop + this.viewportHeight) / rowHeight) + overscan));
  visibleRows = $derived(this.filteredEvents.slice(this.startIndex, this.endIndex));
  topPadding = $derived(this.startIndex * rowHeight);
  bottomPadding = $derived(Math.max(0, (this.totalRows - this.endIndex) * rowHeight));

  hasActiveFilters = $derived(
    this.filters.from !== '' ||
      this.filters.to !== '' ||
      this.filters.event.trim() !== '' ||
      this.filters.stage.trim() !== '' ||
      this.filters.origin.trim() !== '' ||
      this.filters.traceId.trim() !== '' ||
      this.filters.chatId.trim() !== '' ||
      this.filters.q.trim() !== ''
  );

  liveLabel = $derived(
    this.connectionState === 'live'
      ? 'Live'
      : this.connectionState === 'connecting'
        ? 'Connecting'
        : this.connectionState === 'reconnecting'
          ? 'Reconnecting'
          : 'Disconnected'
  );

  constructor() {
    $effect(() => {
      if (this.selectedGroup !== allGroupsKey && !this.groups.some((group) => group.key === this.selectedGroup)) {
        this.selectedGroup = allGroupsKey;
      }
    });

    $effect(() => {
      const hasSelected = this.selectedId !== null && this.filteredEvents.some((item) => item.id === this.selectedId);
      if (this.filteredEvents.length === 0) {
        this.selectedId = null;
        return;
      }

      if (!hasSelected) {
        this.selectedId = this.filteredEvents[0]?.id ?? null;
      }
    });

    $effect(() => {
      const traceId = this.selectedEvent?.trace?.traceId;

      if (!traceId) {
        this.traceTimeline = [];
        this.currentTraceRequest = null;
        return;
      }

      if (traceId === this.currentTraceRequest) {
        return;
      }

      this.currentTraceRequest = traceId;
      void this.loadTrace(traceId);
    });

    $effect(() => {
      this.resizeObserver?.disconnect();

      if (!this.listPane) {
        return;
      }

      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.viewportHeight = entry.contentRect.height;
        }
      });

      this.resizeObserver.observe(this.listPane);

      return () => {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
      };
    });
  }

  setFilter(key: keyof UiFilters, value: string): void {
    this.filters = {
      ...this.filters,
      [key]: value
    };
  }

  async start(): Promise<void> {
    await this.fetchEvents(null, false);
    this.startStream();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }
  }

  stop(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.connectionState = 'disconnected';

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
    }
  }

  private startStream(): void {
    this.eventSource?.close();
    this.connectionState = 'connecting';

    this.eventSource = connectEventStream({
      onEnvelope: (envelope) => {
        this.handleSse(envelope);
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

  async fetchEvents(cursor?: string | null, append = false): Promise<void> {
    if (append) {
      this.loadingMore = true;
    } else {
      this.loading = true;
    }

    try {
      const payload = await fetchEvents(this.filters, cursor);

      this.events = append ? mergeUniqueTop(this.events, payload.items) : payload.items;
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

  async loadTrace(traceId: string): Promise<void> {
    try {
      const payload = await fetchTraceEvents(this.filters, traceId);

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

  async applyFilters(): Promise<void> {
    this.selectedGroup = allGroupsKey;
    this.nextCursor = null;
    this.resetListScroll();
    await this.fetchEvents(null, false);
  }

  async resetFilters(): Promise<void> {
    this.filters = createDefaultFilters();
    await this.applyFilters();
  }

  setGroupingMode(mode: GroupMode): void {
    if (this.groupingMode === mode) {
      return;
    }

    this.groupingMode = mode;
    this.selectedGroup = allGroupsKey;
    this.resetListScroll();
  }

  selectGroup(group: string): void {
    this.selectedGroup = group;
    this.resetListScroll();
  }

  selectEvent(id: string): void {
    this.selectedId = id;
  }

  setInspectorTab(tab: InspectorTab): void {
    this.inspectorTab = tab;
  }

  toggleMobileGroups(open?: boolean): void {
    this.mobileGroupsOpen = open ?? !this.mobileGroupsOpen;
  }

  setListPane(node: HTMLDivElement | null): void {
    this.listPane = node;
  }

  onListScroll = (event: Event): void => {
    const target = event.currentTarget as HTMLDivElement;
    this.scrollTop = target.scrollTop;

    const threshold = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (threshold < 220 && this.nextCursor && !this.loadingMore) {
      void this.fetchEvents(this.nextCursor, true);
    }
  };

  private resetListScroll(): void {
    this.scrollTop = 0;

    if (this.listPane) {
      this.listPane.scrollTop = 0;
    }
  }

  private moveSelection(direction: 1 | -1): void {
    if (this.filteredEvents.length === 0) {
      return;
    }

    const index = this.selectedId ? this.filteredEvents.findIndex((item) => item.id === this.selectedId) : -1;
    const nextIndex = index < 0 ? 0 : Math.max(0, Math.min(this.filteredEvents.length - 1, index + direction));
    this.selectedId = this.filteredEvents[nextIndex]?.id ?? null;
  }

  onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;

    if (target instanceof HTMLElement) {
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveSelection(1);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveSelection(-1);
    }
  };

  isEventInGroup(event: NormalizedEvent, groupKey: string): boolean {
    if (this.groupingMode === 'types') {
      const type = getEventType(event);
      return type === groupKey || type.startsWith(`${groupKey}.`);
    }

    return getTraceGroupKey(event) === groupKey;
  }

  private handleSse(envelope: SseEnvelope): void {
    if (envelope.type === 'snapshot') {
      this.events = mergeUniqueTop(this.events, envelope.payload.items);
      this.total = Math.max(this.total, envelope.payload.total);
      this.dropped = Math.max(this.dropped, envelope.payload.dropped);
      this.sources = Object.fromEntries(envelope.payload.sources.map((status) => [status.sourceId, status]));
      return;
    }

    if (envelope.type === 'source_status') {
      this.sources = {
        ...this.sources,
        [envelope.payload.sourceId]: envelope.payload
      };
      return;
    }

    if (envelope.type === 'append') {
      if (!eventMatchesFilters(envelope.payload, this.filters)) {
        return;
      }

      this.events = mergeUniqueTop(this.events, [envelope.payload]);
      this.total += 1;
    }
  }
}
