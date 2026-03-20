import type { EventFilterQuery, EventListResponse, NormalizedEvent } from '@tracegraph/shared';
import { toSearchText } from './normalize';

interface IndexBucket {
  eventType: Map<string, Set<string>>;
  event: Map<string, Set<string>>;
  stage: Map<string, Set<string>>;
  origin: Map<string, Set<string>>;
  traceId: Map<string, Set<string>>;
  chatId: Map<string, Set<string>>;
}

function getEventType(event: NormalizedEvent): string {
  const derivedType = event.derived?.eventType?.trim();
  if (derivedType) {
    return derivedType;
  }

  return event.event.trim() || 'unknown';
}

function addToIndex(index: Map<string, Set<string>>, key: string | undefined, id: string): void {
  if (!key) {
    return;
  }
  if (!index.has(key)) {
    index.set(key, new Set());
  }
  index.get(key)!.add(id);
}

function removeFromIndex(index: Map<string, Set<string>>, key: string | undefined, id: string): void {
  if (!key) {
    return;
  }
  const bucket = index.get(key);
  if (!bucket) {
    return;
  }
  bucket.delete(id);
  if (bucket.size === 0) {
    index.delete(key);
  }
}

function intersectSets(a: Set<string>, b: Set<string>): Set<string> {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const out = new Set<string>();
  for (const item of small) {
    if (large.has(item)) {
      out.add(item);
    }
  }
  return out;
}

function unionSets(sets: Set<string>[]): Set<string> {
  const out = new Set<string>();
  for (const set of sets) {
    for (const value of set) {
      out.add(value);
    }
  }
  return out;
}

function parseDateOrUndefined(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

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

  private readonly searchTextById = new Map<string, string>();

  private readonly indexes: IndexBucket = {
    eventType: new Map(),
    event: new Map(),
    stage: new Map(),
    origin: new Map(),
    traceId: new Map(),
    chatId: new Map()
  };

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
    for (let i = this.count - 1; i >= 0 && items.length < target; i -= 1) {
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
    this.searchTextById.set(event.id, toSearchText(event));

    addToIndex(this.indexes.eventType, getEventType(event), event.id);
    addToIndex(this.indexes.event, event.event, event.id);
    addToIndex(this.indexes.stage, event.stage, event.id);
    addToIndex(this.indexes.origin, event.trace?.origin, event.id);
    addToIndex(this.indexes.traceId, event.trace?.traceId, event.id);
    addToIndex(this.indexes.chatId, event.chatId, event.id);

    if (evicted) {
      this.byId.delete(evicted.id);
      this.searchTextById.delete(evicted.id);
      removeFromIndex(this.indexes.eventType, getEventType(evicted), evicted.id);
      removeFromIndex(this.indexes.event, evicted.event, evicted.id);
      removeFromIndex(this.indexes.stage, evicted.stage, evicted.id);
      removeFromIndex(this.indexes.origin, evicted.trace?.origin, evicted.id);
      removeFromIndex(this.indexes.traceId, evicted.trace?.traceId, evicted.id);
      removeFromIndex(this.indexes.chatId, evicted.chatId, evicted.id);
    }
  }

  query(rawQuery: EventFilterQuery): EventListResponse {
    const query = {
      ...rawQuery,
      limit: clampLimit(rawQuery.limit)
    };

    const cursor = parseCursor(query.cursor);
    const fromMs = parseDateOrUndefined(query.from);
    const toMs = parseDateOrUndefined(query.to);
    const q = query.q?.trim().toLowerCase();

    const candidate = this.resolveCandidateSet(query);

    const ordered = candidate ? this.resolveEventsFromSet(candidate) : this.iterAllDesc();

    const filtered = ordered.filter((event) => {
      if (fromMs !== undefined && Date.parse(event.timestamp) < fromMs) {
        return false;
      }
      if (toMs !== undefined && Date.parse(event.timestamp) > toMs) {
        return false;
      }
      if (q) {
        const search = this.searchTextById.get(event.id);
        if (!search?.includes(q)) {
          return false;
        }
      }
      return true;
    });

    const cursorFiltered = cursor ? filtered.filter((event) => event.seq < cursor) : filtered;
    const items = cursorFiltered.slice(0, query.limit);
    const nextCursor = cursorFiltered.length > query.limit ? String(items[items.length - 1]?.seq ?? '') : null;

    return {
      items,
      nextCursor,
      total: filtered.length,
      dropped: this.dropped
    };
  }

  private resolveCandidateSet(query: EventFilterQuery): Set<string> | null {
    const constraints: Array<Set<string> | null> = [];

    const rawEventTypes = Array.isArray(query.eventType) ? query.eventType : query.eventType ? [query.eventType] : [];
    const eventTypes = [...new Set(rawEventTypes.map((value) => value.trim()).filter(Boolean))];
    if (eventTypes.length > 0) {
      const perTypeSets = eventTypes.map((eventType) => this.indexes.eventType.get(eventType) ?? new Set<string>());
      constraints.push(unionSets(perTypeSets));
    }
    if (query.event) {
      constraints.push(this.indexes.event.get(query.event) ?? new Set());
    }
    if (query.stage) {
      constraints.push(this.indexes.stage.get(query.stage) ?? new Set());
    }
    if (query.origin) {
      constraints.push(this.indexes.origin.get(query.origin) ?? new Set());
    }
    if (query.traceId) {
      constraints.push(this.indexes.traceId.get(query.traceId) ?? new Set());
    }
    if (query.chatId) {
      constraints.push(this.indexes.chatId.get(query.chatId) ?? new Set());
    }

    if (constraints.length === 0) {
      return null;
    }

    let result = constraints[0] ?? new Set<string>();
    for (let i = 1; i < constraints.length; i += 1) {
      result = intersectSets(result, constraints[i] ?? new Set<string>());
      if (result.size === 0) {
        return result;
      }
    }

    return result;
  }

  private resolveEventsFromSet(set: Set<string>): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];
    for (const id of set) {
      const event = this.byId.get(id);
      if (event) {
        events.push(event);
      }
    }
    events.sort((a, b) => b.seq - a.seq);
    return events;
  }

  private iterAllDesc(): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];
    for (let i = this.count - 1; i >= 0; i -= 1) {
      const event = this.readByOrdinal(i);
      if (event) {
        events.push(event);
      }
    }
    return events;
  }

  private readByOrdinal(ordinal: number): NormalizedEvent | null {
    if (ordinal < 0 || ordinal >= this.count) {
      return null;
    }
    const slot = (this.head + ordinal) % this.capacity;
    return this.slots[slot];
  }
}
