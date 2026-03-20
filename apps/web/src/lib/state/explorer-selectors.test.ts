import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '@tracegraph/shared';
import {
  allGroupsKey,
  buildGroups,
  buildVirtualWindow,
  filtersEqual,
  filtersHaveValues,
  selectFilteredEvents
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
  it('builds grouped views and filters by selected group', () => {
    const events = [
      makeEvent(3, { event: 'provider.openai.request.completed' }),
      makeEvent(2, { event: 'tool.workflow.progress' }),
      makeEvent(1, { event: 'provider.openai.request.started' })
    ];

    const groups = buildGroups(events, 'types');
    expect(groups.some((group) => group.key === 'provider.openai.request')).toBe(true);

    const filtered = selectFilteredEvents(events, 'types', 'provider.openai.request');
    expect(filtered.map((event) => event.event)).toEqual([
      'provider.openai.request.completed',
      'provider.openai.request.started'
    ]);

    expect(selectFilteredEvents(events, 'types', allGroupsKey)).toEqual(events);
  });

  it('computes virtualization windows for visible slices', () => {
    const window = buildVirtualWindow(100, 500, 250, 50, 2);

    expect(window.startIndex).toBe(8);
    expect(window.endIndex).toBe(17);
    expect(window.topPadding).toBe(400);
    expect(window.bottomPadding).toBe(4150);
  });

  it('detects active filters and unapplied equality checks', () => {
    const base = {
      from: '',
      to: '',
      event: '',
      stage: '',
      origin: '',
      traceId: '',
      chatId: '',
      q: ''
    };

    expect(filtersHaveValues(base)).toBe(false);
    expect(filtersEqual(base, { ...base })).toBe(true);
    expect(filtersHaveValues({ ...base, q: 'needle' })).toBe(true);
    expect(filtersEqual(base, { ...base, q: 'needle' })).toBe(false);
  });
});
