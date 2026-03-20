import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '@tracegraph/shared';
import { buildParsedFields, createDefaultFilters } from './explorer-helpers';

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

describe('explorer state helpers', () => {
  it('builds parsed fields and omits unavailable values', () => {
    const parsed = buildParsedFields(
      makeEvent(1, {
        trace: undefined,
        derived: {
          eventType: 'workflow.progress',
          success: true,
          statusCode: 200
        }
      })
    );

    expect(parsed.some((field) => field.label === 'Trace ID')).toBe(false);
    expect(parsed.some((field) => field.label === 'Event Type' && field.value === 'workflow.progress')).toBe(true);
    expect(parsed.some((field) => field.label === 'Success' && field.value === 'true')).toBe(true);
    expect(parsed.some((field) => field.label === 'HTTP Status' && field.value === '200')).toBe(true);
  });

  it('creates empty filters by default', () => {
    expect(createDefaultFilters()).toEqual({
      eventTypes: [],
      q: ''
    });
  });
});
