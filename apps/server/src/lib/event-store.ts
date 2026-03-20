import type { EventFilterQuery, EventListResponse, NormalizedEvent } from '@tracegraph/shared';

function parseCursor(cursor: string | undefined): number | undefined {
  if (!cursor) {
    return undefined;
  }

  const value = Number.parseInt(cursor, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function clampLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 200;
  }

  return Math.max(1, Math.min(1000, Math.floor(value)));
}

export class EventStore {
  private readonly capacity: number;

  private readonly slots: Array<NormalizedEvent | null>;

  private head = 0;

  private count = 0;

  private dropped = 0;

  private readonly byId = new Map<string, NormalizedEvent>();

  constructor(capacity = 100_000) {
    this.capacity = capacity;
    this.slots = Array.from({ length: capacity }, () => null);
  }

  get size(): number {
    return this.count;
  }

  get droppedCount(): number {
    return this.dropped;
  }

  getById(id: string): NormalizedEvent | null {
    return this.byId.get(id) ?? null;
  }

  getLatest(limit = 200): NormalizedEvent[] {
    const items: NormalizedEvent[] = [];
    const target = Math.max(1, Math.min(limit, this.count));
    const startOrdinal = Math.max(0, this.count - target);

    for (let i = startOrdinal; i < this.count; i += 1) {
      const event = this.readByOrdinal(i);
      if (event) {
        items.push(event);
      }
    }

    return items;
  }

  add(event: NormalizedEvent): void {
    let evicted: NormalizedEvent | null = null;

    if (this.count < this.capacity) {
      const slot = (this.head + this.count) % this.capacity;
      this.slots[slot] = event;
      this.count += 1;
    } else {
      evicted = this.slots[this.head];
      this.slots[this.head] = event;
      this.head = (this.head + 1) % this.capacity;
      this.dropped += 1;
    }

    this.byId.set(event.id, event);

    if (evicted) {
      this.byId.delete(evicted.id);
    }
  }

  query(rawQuery: EventFilterQuery): EventListResponse {
    const limit = clampLimit(rawQuery.limit);
    const cursor = parseCursor(rawQuery.cursor);

    const items: NormalizedEvent[] = [];
    let matchedCount = 0;

    for (let i = 0; i < this.count; i += 1) {
      const event = this.readByOrdinal(i);
      if (!event) {
        continue;
      }

      if (cursor !== undefined && event.seq <= cursor) {
        continue;
      }

      matchedCount += 1;
      if (items.length < limit) {
        items.push(event);
      }
    }

    const hasMore = matchedCount > items.length;

    return {
      items,
      nextCursor: hasMore && items.length > 0 ? String(items[items.length - 1]?.seq ?? '') : null,
      total: this.count,
      dropped: this.dropped
    };
  }

  queryTrace(traceId: string, rawQuery: EventFilterQuery): EventListResponse {
    const limit = clampLimit(rawQuery.limit);
    const cursor = parseCursor(rawQuery.cursor);
    const normalizedTraceId = traceId.trim();

    const items: NormalizedEvent[] = [];
    let totalMatches = 0;
    let cursorMatches = 0;

    for (let i = 0; i < this.count; i += 1) {
      const event = this.readByOrdinal(i);
      if (!event) {
        continue;
      }

      if (event.trace?.traceId !== normalizedTraceId) {
        continue;
      }

      totalMatches += 1;

      if (cursor !== undefined && event.seq <= cursor) {
        continue;
      }

      cursorMatches += 1;
      if (items.length < limit) {
        items.push(event);
      }
    }

    const hasMore = cursorMatches > items.length;

    return {
      items,
      nextCursor: hasMore && items.length > 0 ? String(items[items.length - 1]?.seq ?? '') : null,
      total: totalMatches,
      dropped: this.dropped
    };
  }

  private readByOrdinal(ordinal: number): NormalizedEvent | null {
    if (ordinal < 0 || ordinal >= this.count) {
      return null;
    }

    const slot = (this.head + ordinal) % this.capacity;
    return this.slots[slot];
  }
}
