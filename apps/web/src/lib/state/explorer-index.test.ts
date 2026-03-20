import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '@tracegraph/shared';
import { IncrementalEventIndex } from './explorer-index';

function makeEvent(seq: number, overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    id: `event-${seq}`,
    seq,
    sourceId: 'source-a',
    sourceLabel: 'Source A',
    line: seq,
    offset: seq,
    ingestedAt: '2026-03-13T03:46:49.053Z',
    timestamp: `2026-03-13T03:46:${String(seq).padStart(2, '0')}.000Z`,
    event: 'tool.workflow.progress',
    stage: 'completed',
    chatId: 'chat-1',
    messageId: 'msg-1',
    senderId: 'user-1',
    trace: {
      traceId: 'trace-1',
      spanId: `span-${seq}`,
      parentSpanId: seq > 1 ? `span-${seq - 1}` : null,
      origin: 'tool'
    },
    raw: {
      event: 'tool.workflow.progress'
    },
    ...overrides
  };
}

describe('incremental event index', () => {
  it('keeps ascending seq order while inserting without full sort', () => {
    const index = new IncrementalEventIndex();

    index.merge([makeEvent(3), makeEvent(1), makeEvent(4), makeEvent(2)]);

    expect(index.toArray().map((event) => event.id)).toEqual(['event-1', 'event-2', 'event-3', 'event-4']);
  });

  it('replaces existing id and repositions only when seq changes', () => {
    const index = new IncrementalEventIndex();

    index.merge([makeEvent(3), makeEvent(2), makeEvent(1)]);
    index.upsert(makeEvent(2, { stage: 'updated' }));

    expect(index.toArray().map((event) => event.id)).toEqual(['event-1', 'event-2', 'event-3']);
    expect(index.toArray()[1]?.stage).toBe('updated');

    index.upsert(
      makeEvent(2, {
        id: 'event-2',
        seq: 5,
        timestamp: '2026-03-13T03:47:05.000Z'
      })
    );

    expect(index.toArray().map((event) => event.id)).toEqual(['event-1', 'event-3', 'event-2']);
  });

  it('trims old items to the configured cap', () => {
    const index = new IncrementalEventIndex(3);

    index.merge([makeEvent(1), makeEvent(2), makeEvent(3), makeEvent(4)]);

    expect(index.toArray().map((event) => event.id)).toEqual(['event-2', 'event-3', 'event-4']);
  });
});
