import type { NormalizedEvent } from '@tracegraph/shared';
import {
  buildEventTypeGroups,
  buildTraceGroups,
  getEventType,
  getTraceGroupKey,
  type EventTypeGroup,
  type UiFilters
} from '../ui';

export type GroupMode = 'types' | 'traces';

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  topPadding: number;
  bottomPadding: number;
}

export const allGroupsKey = '__all_groups__';
export const rowHeight = 50;
export const overscan = 10;

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function filtersEqual(a: UiFilters, b: UiFilters): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.event === b.event &&
    a.stage === b.stage &&
    a.origin === b.origin &&
    a.traceId === b.traceId &&
    a.chatId === b.chatId &&
    a.q === b.q
  );
}

export function filtersHaveValues(filters: UiFilters): boolean {
  return (
    filters.from !== '' ||
    filters.to !== '' ||
    hasText(filters.event) ||
    hasText(filters.stage) ||
    hasText(filters.origin) ||
    hasText(filters.traceId) ||
    hasText(filters.chatId) ||
    hasText(filters.q)
  );
}

export function buildGroups(events: NormalizedEvent[], mode: GroupMode): EventTypeGroup[] {
  return mode === 'types' ? buildEventTypeGroups(events) : buildTraceGroups(events);
}

export function isEventInGroup(event: NormalizedEvent, mode: GroupMode, groupKey: string): boolean {
  if (mode === 'types') {
    const type = getEventType(event);
    return type === groupKey || type.startsWith(`${groupKey}.`);
  }

  return getTraceGroupKey(event) === groupKey;
}

export function selectFilteredEvents(
  events: NormalizedEvent[],
  mode: GroupMode,
  selectedGroup: string
): NormalizedEvent[] {
  if (selectedGroup === allGroupsKey) {
    return events;
  }

  return events.filter((event) => isEventInGroup(event, mode, selectedGroup));
}

export function buildVirtualWindow(
  totalRows: number,
  scrollTop: number,
  viewportHeight: number,
  height = rowHeight,
  overscanRows = overscan
): VirtualWindow {
  const startIndex = Math.max(0, Math.floor(scrollTop / height) - overscanRows);
  const endIndex = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / height) + overscanRows);

  return {
    startIndex,
    endIndex,
    topPadding: startIndex * height,
    bottomPadding: Math.max(0, (totalRows - endIndex) * height)
  };
}
