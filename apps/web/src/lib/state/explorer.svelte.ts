import type { NormalizedEvent } from '@tracegraph/shared';
import { buildVirtualWindow, buildGroups, overscan, rowHeight, allGroupsKey, type GroupMode } from './explorer-selectors';
import { ExplorerDataState, type ConnectionState } from './explorer-data.svelte';
import { ExplorerViewState, type InspectorTab } from './explorer-view.svelte';
import { buildParsedFields, type ParsedField } from './explorer-helpers';
import { highlightJsonSyntax, toPrettyInspectorJson, type TimelineItem } from '$lib/ui';

export type { ParsedField };
export type { GroupMode, InspectorTab, ConnectionState };
export { allGroupsKey };

export class ExplorerState {
  private readonly data = new ExplorerDataState();
  private readonly view = new ExplorerViewState();

  groups = $derived(buildGroups(this.data.events, this.view.groupingMode));

  selectedEvent = $derived(this.data.events.find((event) => event.id === this.view.selectedId) ?? null);

  parsedFields = $derived(this.selectedEvent ? buildParsedFields(this.selectedEvent) : []);
  rawInspectorJson = $derived(this.selectedEvent ? toPrettyInspectorJson(this.selectedEvent.raw) : '');
  highlightedRawInspectorJson = $derived(highlightJsonSyntax(this.rawInspectorJson));

  totalRows = $derived(this.data.events.length);
  virtualWindow = $derived(
    buildVirtualWindow(this.totalRows, this.view.scrollTop, this.view.viewportHeight, rowHeight, overscan)
  );

  startIndex = $derived(this.virtualWindow.startIndex);
  endIndex = $derived(this.virtualWindow.endIndex);
  visibleRows = $derived(this.data.events.slice(this.startIndex, this.endIndex));
  topPadding = $derived(this.virtualWindow.topPadding);
  bottomPadding = $derived(this.virtualWindow.bottomPadding);

  constructor() {
    $effect(() => {
      this.view.ensureSelectedGroupExists(this.groups.map((group) => group.key));
    });

    $effect(() => {
      this.view.ensureSelectedEventExists(this.data.events);
    });

    $effect(() => {
      const traceId = this.selectedEvent?.trace?.traceId ?? null;
      void this.data.syncTraceTimeline(traceId);
    });
  }

  get events(): NormalizedEvent[] {
    return this.data.events;
  }

  get nextCursor(): string | null {
    return this.data.nextCursor;
  }

  get total(): number {
    return this.data.total;
  }

  get dropped(): number {
    return this.data.dropped;
  }

  get loading(): boolean {
    return this.data.loading;
  }

  get loadingMore(): boolean {
    return this.data.loadingMore;
  }

  get sources() {
    return this.data.sources;
  }

  get sourceList() {
    return this.data.sourceList;
  }

  get traceTimeline(): TimelineItem[] {
    return this.data.traceTimeline;
  }

  get groupingMode(): GroupMode {
    return this.view.groupingMode;
  }

  get selectedGroup(): string {
    return this.view.selectedGroup;
  }

  get mobileGroupsOpen(): boolean {
    return this.view.mobileGroupsOpen;
  }

  set mobileGroupsOpen(open: boolean) {
    this.view.mobileGroupsOpen = open;
  }

  get mobileInspectorOpen(): boolean {
    return this.view.mobileInspectorOpen;
  }

  set mobileInspectorOpen(open: boolean) {
    this.view.mobileInspectorOpen = open;
  }

  get selectedId(): string | null {
    return this.view.selectedId;
  }

  get inspectorTab(): InspectorTab {
    return this.view.inspectorTab;
  }

  set inspectorTab(tab: InspectorTab) {
    this.view.inspectorTab = tab;
  }

  get connectionState(): ConnectionState {
    return this.data.connectionState;
  }

  get errorMessage(): string | null {
    return this.data.errorMessage;
  }

  get liveLabel(): string {
    return this.data.liveLabel;
  }

  async start(): Promise<void> {
    await this.data.start();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }
  }

  stop(): void {
    this.data.stop();
    this.view.stop();

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
    }
  }

  reconnectStream(): void {
    this.data.reconnectStream();
  }

  async retryList(): Promise<void> {
    await this.data.retryList();
  }

  setGroupingMode(mode: GroupMode): void {
    this.view.setGroupingMode(mode);
  }

  selectGroup(group: string): void {
    this.view.selectGroup(group);
  }

  selectEvent(id: string): void {
    this.view.selectEvent(id);
  }

  setInspectorTab(tab: InspectorTab): void {
    this.view.setInspectorTab(tab);
  }

  openInspectorContext(): void {
    this.view.openInspectorContext();
  }

  toggleMobileGroups(open?: boolean): void {
    this.view.toggleMobileGroups(open);
  }

  toggleMobileInspector(open?: boolean): void {
    this.view.toggleMobileInspector(open);
  }

  setListPane(node: HTMLDivElement | null): void {
    this.view.setListPane(node);
  }

  setInspectorPane(node: HTMLElement | null): void {
    this.view.setInspectorPane(node);
  }

  onListScroll = (event: Event): void => {
    const reachedBottom = this.view.onListScroll(event);

    if (reachedBottom && this.data.nextCursor && !this.data.loadingMore) {
      void this.data.fetchEvents(this.data.nextCursor, true);
    }
  };

  onKeyDown = (event: KeyboardEvent): void => {
    this.view.onKeyDown(event, this.data.events);
  };
}
