import type { NormalizedEvent } from '@tracegraph/shared';
import { allGroupsKey, rowHeight, type GroupMode } from './explorer-selectors';

export type InspectorTab = 'parsed' | 'raw' | 'trace';

const loadMoreThreshold = 220;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export class ExplorerViewState {
  groupingMode = $state<GroupMode>('traces');
  selectedGroup = $state(allGroupsKey);
  mobileGroupsOpen = $state(false);

  selectedId = $state<string | null>(null);
  inspectorTab = $state<InspectorTab>('parsed');
  mobileInspectorOpen = $state(false);

  listPane = $state<HTMLDivElement | null>(null);
  inspectorPane = $state<HTMLElement | null>(null);
  scrollTop = $state(0);
  viewportHeight = $state(520);

  private resizeObserver: ResizeObserver | null = null;

  stop(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
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

  selectEvent(id: string, options?: { openInspectorOnMobile?: boolean }): void {
    this.selectedId = id;

    if (options?.openInspectorOnMobile !== false && this.isMobileViewport()) {
      this.mobileInspectorOpen = true;
    }
  }

  setInspectorTab(tab: InspectorTab): void {
    this.inspectorTab = tab;
  }

  toggleMobileGroups(open?: boolean): void {
    this.mobileGroupsOpen = open ?? !this.mobileGroupsOpen;
  }

  toggleMobileInspector(open?: boolean): void {
    this.mobileInspectorOpen = open ?? !this.mobileInspectorOpen;
  }

  setListPane(node: HTMLDivElement | null): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.listPane = node;

    if (!node) {
      return;
    }

    this.viewportHeight = node.clientHeight;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.viewportHeight = entry.contentRect.height;
      }
    });

    this.resizeObserver.observe(node);
  }

  setInspectorPane(node: HTMLElement | null): void {
    this.inspectorPane = node;
  }

  onListScroll(event: Event): boolean {
    const target = event.currentTarget as HTMLDivElement;
    this.scrollTop = target.scrollTop;

    const threshold = target.scrollHeight - target.scrollTop - target.clientHeight;
    return threshold < loadMoreThreshold;
  }

  ensureSelectedGroupExists(groupKeys: string[]): void {
    if (this.selectedGroup !== allGroupsKey && !groupKeys.includes(this.selectedGroup)) {
      this.selectedGroup = allGroupsKey;
    }
  }

  ensureSelectedEventExists(events: NormalizedEvent[]): void {
    const hasSelected = this.selectedId !== null && events.some((item) => item.id === this.selectedId);

    if (events.length === 0) {
      this.selectedId = null;
      return;
    }

    if (!hasSelected) {
      this.selectedId = events[0]?.id ?? null;
    }
  }

  moveSelection(direction: 1 | -1, events: NormalizedEvent[]): void {
    if (events.length === 0) {
      return;
    }

    const index = this.selectedId ? events.findIndex((item) => item.id === this.selectedId) : -1;
    const nextIndex = index < 0 ? 0 : Math.max(0, Math.min(events.length - 1, index + direction));
    this.selectedId = events[nextIndex]?.id ?? null;

    this.ensureSelectedEventVisible(events);
  }

  onKeyDown(event: KeyboardEvent, events: NormalizedEvent[]): void {
    if (isTypingTarget(event.target)) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveSelection(1, events);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveSelection(-1, events);
      return;
    }

    if (event.key === 'Enter' && this.selectedId) {
      event.preventDefault();
      this.openInspectorContext();
    }
  }

  openInspectorContext(): void {
    if (this.isMobileViewport()) {
      this.mobileInspectorOpen = true;
      return;
    }

    this.inspectorPane?.focus();
  }

  private ensureSelectedEventVisible(events: NormalizedEvent[]): void {
    if (!this.listPane || !this.selectedId) {
      return;
    }

    const index = events.findIndex((event) => event.id === this.selectedId);
    if (index < 0) {
      return;
    }

    const rowTop = index * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const viewportTop = this.listPane.scrollTop;
    const viewportBottom = viewportTop + this.listPane.clientHeight;

    if (rowTop < viewportTop) {
      this.listPane.scrollTop = rowTop;
      this.scrollTop = rowTop;
      return;
    }

    if (rowBottom > viewportBottom) {
      const nextTop = rowBottom - this.listPane.clientHeight;
      this.listPane.scrollTop = nextTop;
      this.scrollTop = nextTop;
    }
  }

  private resetListScroll(): void {
    this.scrollTop = 0;

    if (this.listPane) {
      this.listPane.scrollTop = 0;
    }
  }

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(max-width: 1023px)').matches;
  }
}
