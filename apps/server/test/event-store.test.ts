import { describe, expect, it } from 'bun:test';
import { EventStore } from '../src/lib/event-store';
import { makeEvent } from './helpers';

describe('EventStore query', () => {
  it('returns ascending chronological pages with stable nextCursor', () => {
    const store = new EventStore(10);

    store.add(makeEvent(1, { event: 'first' }));
    store.add(makeEvent(2, { event: 'second' }));
    store.add(makeEvent(3, { event: 'third' }));

    const firstPage = store.query({ limit: 2 });
    expect(firstPage.items.map((item) => item.seq)).toEqual([1, 2]);
    expect(firstPage.nextCursor).toBe('2');
    expect(firstPage.total).toBe(3);

    const secondPage = store.query({ limit: 2, cursor: firstPage.nextCursor ?? undefined });
    expect(secondPage.items.map((item) => item.seq)).toEqual([3]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('ignores invalid cursors', () => {
    const store = new EventStore(10);

    store.add(makeEvent(1, { event: 'first' }));
    store.add(makeEvent(2, { event: 'second' }));

    const page = store.query({ cursor: 'not-a-number', limit: 10 });
    expect(page.items.map((item) => item.seq)).toEqual([1, 2]);
  });

  it('returns paginated trace timelines without generic filter indexes', () => {
    const store = new EventStore(10);

    store.add(makeEvent(1, { trace: { traceId: 'trace-a', spanId: 's1', parentSpanId: null, origin: 'tool' } }));
    store.add(makeEvent(2, { trace: { traceId: 'trace-b', spanId: 's2', parentSpanId: null, origin: 'tool' } }));
    store.add(makeEvent(3, { trace: { traceId: 'trace-a', spanId: 's3', parentSpanId: 's1', origin: 'tool' } }));

    const firstPage = store.queryTrace('trace-a', { limit: 1 });
    expect(firstPage.items.map((item) => item.seq)).toEqual([1]);
    expect(firstPage.nextCursor).toBe('1');

    const secondPage = store.queryTrace('trace-a', { limit: 1, cursor: firstPage.nextCursor ?? undefined });
    expect(secondPage.items.map((item) => item.seq)).toEqual([3]);
    expect(secondPage.nextCursor).toBeNull();
    expect(secondPage.total).toBe(2);
  });

  it('caps storage and tracks dropped events', () => {
    const store = new EventStore(2);
    store.add(makeEvent(1));
    store.add(makeEvent(2));
    store.add(makeEvent(3));

    expect(store.size).toBe(2);
    expect(store.droppedCount).toBe(1);

    const latest = store.query({ limit: 10 });
    expect(latest.items.map((item) => item.seq)).toEqual([2, 3]);
  });
});
