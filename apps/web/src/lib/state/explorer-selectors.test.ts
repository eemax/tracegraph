import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '@tracegraph/shared';
import {
  buildGroups,
  buildVirtualWindow,
  isEventInGroup
} from './explorer-selectors';

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
      traceId: seq % 2 === 0 ? 'trace-even' : 'trace-odd',
      spanId: `span-${seq}`,
      parentSpanId: null,
      origin: 'tool'
    },
    raw: {
      event: 'tool.workflow.progress'
    },
    ...overrides
  };
}

describe('explorer selectors', () => {
  it('builds grouped views and evaluates group membership', () => {
    const events = [
      makeEvent(3, { event: 'provider.openai.request.completed' }),
      makeEvent(2, { event: 'tool.workflow.progress' }),
      makeEvent(1, { event: 'provider.openai.request.started' })
    ];

    const groups = buildGroups(events, 'traces');
    expect(groups.map((group) => group.key)).toEqual(['trace-odd', 'trace-even']);

    expect(isEventInGroup(events[0], 'traces', 'trace-odd')).toBe(true);
    expect(isEventInGroup(events[1], 'traces', 'trace-odd')).toBe(false);
  });

  it('computes virtualization windows for visible slices', () => {
    const window = buildVirtualWindow(100, 500, 250, 50, 2);

    expect(window.startIndex).toBe(8);
    expect(window.endIndex).toBe(17);
    expect(window.topPadding).toBe(400);
    expect(window.bottomPadding).toBe(4150);
  });
});
