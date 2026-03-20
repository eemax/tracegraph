import type { NormalizedEvent } from '@tracegraph/shared';
import {
  buildTraceGroups,
  getTraceGroupKey,
  type EventTypeGroup,
  type UiFilters
} from '../ui';

export type GroupMode = 'traces';

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

function normalizeEventTypes(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function filtersEqual(a: UiFilters, b: UiFilters): boolean {
  const aTypes = normalizeEventTypes(a.eventTypes);
  const bTypes = normalizeEventTypes(b.eventTypes);
  return aTypes.length === bTypes.length && aTypes.every((value, index) => value === bTypes[index]) && a.q === b.q;
}

export function filtersHaveValues(filters: UiFilters): boolean {
  return filters.eventTypes.some(hasText) || hasText(filters.q);
}

export function buildGroups(events: NormalizedEvent[], mode: GroupMode): EventTypeGroup[] {
  return buildTraceGroups(events);
}

export function isEventInGroup(event: NormalizedEvent, mode: GroupMode, groupKey: string): boolean {
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
