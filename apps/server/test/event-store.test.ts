import { describe, expect, it } from 'bun:test';
import { EventStore } from '../src/lib/event-store';
import { makeEvent } from './helpers';

describe('EventStore query', () => {
  it('supports filter combinations and full-text search', () => {
    const store = new EventStore(10);

    store.add(
      makeEvent(1, {
        event: 'telegram.inbound.received',
        stage: 'received',
        chatId: 'chat-1',
        trace: { traceId: 'trace-1', spanId: 'span-1', parentSpanId: null, origin: 'telegram' },
        payload: { text: 'How are you' }
      })
    );
    store.add(
      makeEvent(2, {
        event: 'routing.gatekeeping.checked',
        stage: 'checked',
        chatId: 'chat-2',
        trace: { traceId: 'trace-2', spanId: 'span-2', parentSpanId: null, origin: 'routing' },
        payload: { allowed: true }
      })
    );

    const filtered = store.query({
      event: 'telegram.inbound.received',
      stage: 'received',
      origin: 'telegram',
      chatId: 'chat-1',
      q: 'how are you'
    });

    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]?.seq).toBe(1);
  });

  it('supports multi-select eventType filtering', () => {
    const store = new EventStore(10);

    store.add(
      makeEvent(1, {
        event: 'provider.request.started',
        payload: { text: 'start' }
      })
    );
    store.add(
      makeEvent(2, {
        event: 'provider.request.completed',
        payload: { text: 'done' }
      })
    );
    store.add(
      makeEvent(3, {
        event: 'tool.workflow.progress',
        payload: { text: 'progress' }
      })
    );

    const filtered = store.query({
      eventType: ['provider.request.started', 'provider.request.completed']
    });

    expect(filtered.items).toHaveLength(2);
    expect(filtered.items.map((item) => item.event)).toEqual(['provider.request.completed', 'provider.request.started']);
  });

  it('caps storage and tracks dropped events', () => {
    const store = new EventStore(2);
    store.add(makeEvent(1));
    store.add(makeEvent(2));
    store.add(makeEvent(3));

    expect(store.size).toBe(2);
    expect(store.droppedCount).toBe(1);

    const latest = store.query({ limit: 10 });
    expect(latest.items.map((item) => item.seq)).toEqual([3, 2]);
  });
});
