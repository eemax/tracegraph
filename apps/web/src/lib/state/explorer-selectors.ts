import type { NormalizedEvent } from '@tracegraph/shared';
import { buildTraceGroups, getTraceGroupKey, type EventTypeGroup } from '../ui';

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

export function buildGroups(events: NormalizedEvent[], _mode: GroupMode): EventTypeGroup[] {
  return buildTraceGroups(events);
}

export function isEventInGroup(event: NormalizedEvent, _mode: GroupMode, groupKey: string): boolean {
  return getTraceGroupKey(event) === groupKey;
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
