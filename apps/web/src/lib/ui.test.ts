import { describe, expect, it } from 'vitest';
import type { NormalizedEvent } from '@tracegraph/shared';
import {
  buildEventTypeGroups,
  buildPaginationQueryString,
  buildTraceGroups,
  buildTraceTimeline,
  formatTraceLabel,
  getEventType,
  getTraceGroupKey,
  highlightJsonSyntax,
  missingTraceGroupKey,
  toPrettyInspectorJson
} from './ui';

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
      event: 'tool.workflow.progress',
      payload: {
        text: seq === 1 ? 'hello' : 'world'
      }
    },
    ...overrides
  };
}

describe('ui helpers', () => {
  it('builds pagination query string', () => {
    const query = buildPaginationQueryString('40', 100);

    expect(query).toContain('cursor=40');
    expect(query).toContain('limit=100');
  });

  it('builds nested trace timeline depths', () => {
    const root = makeEvent(1, {
      trace: { traceId: 'trace-1', spanId: 'root', parentSpanId: null, origin: 'tool' }
    });
    const child = makeEvent(2, {
      trace: { traceId: 'trace-1', spanId: 'child', parentSpanId: 'root', origin: 'provider' }
    });
    const grandChild = makeEvent(3, {
      trace: { traceId: 'trace-1', spanId: 'grand', parentSpanId: 'child', origin: 'provider' }
    });

    const timeline = buildTraceTimeline([grandChild, root, child]);

    expect(timeline.map((item) => item.depth)).toEqual([0, 1, 2]);
  });

  it('prefers derived event type when grouping', () => {
    const event = makeEvent(1, {
      event: 'tool.workflow.progress',
      derived: {
        eventType: 'workflow.progress'
      }
    });

    expect(getEventType(event)).toBe('workflow.progress');
  });

  it('builds nested event type groups in alphabetical order', () => {
    const grouped = buildEventTypeGroups([
      makeEvent(4, { event: 'zeta.result' }),
      makeEvent(2, { event: 'provider.openai.request.completed' }),
      makeEvent(1, { event: 'tool.workflow.progress' }),
      makeEvent(3, { event: 'provider.openai.request.started' })
    ]);

    expect(grouped.map((group) => group.key)).toEqual([
      'provider.openai.request',
      'provider.openai.request.completed',
      'provider.openai.request.started',
      'tool.workflow.progress',
      'zeta.result'
    ]);
    expect(grouped.map((group) => group.label)).toEqual([
      'provider.openai.request',
      'completed',
      'started',
      'tool.workflow.progress',
      'zeta.result'
    ]);
    expect(grouped.find((group) => group.key === 'provider.openai.request')?.count).toBe(2);
    expect(grouped.find((group) => group.key === 'provider.openai.request')?.isLeaf).toBe(false);
    expect(grouped.find((group) => group.key === 'provider.openai.request.completed')?.isLeaf).toBe(true);
  });

  it('builds trace groups sorted by latest activity', () => {
    const grouped = buildTraceGroups([
      makeEvent(1, { trace: { traceId: undefined, spanId: 'span-1', parentSpanId: null, origin: 'tool' } }),
      makeEvent(2, { trace: { traceId: 'trace-1', spanId: 'span-2', parentSpanId: null, origin: 'tool' } }),
      makeEvent(3, { trace: { traceId: 'trace-1', spanId: 'span-3', parentSpanId: 'span-2', origin: 'tool' } }),
      makeEvent(4, { trace: { traceId: 'trace-2', spanId: 'span-4', parentSpanId: null, origin: 'provider' } })
    ]);

    expect(grouped.map((group) => group.key)).toEqual(['trace-2', 'trace-1', missingTraceGroupKey]);
    expect(grouped.map((group) => group.label)).toEqual(['trace...ce-2', 'trace...ce-1', 'no-trace']);
    expect(grouped.find((group) => group.key === 'trace-1')?.count).toBe(2);
    expect(grouped.every((group) => group.depth === 0)).toBe(true);
    expect(grouped.every((group) => group.isLeaf)).toBe(true);
  });

  it('normalizes missing trace ids into a trace group key', () => {
    const traced = makeEvent(1, { trace: { traceId: 'trace-1', spanId: 's1', parentSpanId: null, origin: 'tool' } });
    const untraced = makeEvent(2, { trace: { traceId: '', spanId: 's2', parentSpanId: null, origin: 'tool' } });

    expect(getTraceGroupKey(traced)).toBe('trace-1');
    expect(getTraceGroupKey(untraced)).toBe(missingTraceGroupKey);
  });

  it('formats trace ids to last 4 chars label', () => {
    expect(formatTraceLabel('trace_01KKKS5XVT0GQWTEJT4NV4G3K0')).toBe('trace...G3K0');
  });

  it('parses stringified nested json for raw inspector display', () => {
    const pretty = toPrettyInspectorJson({
      body: {
        input: [
          {
            type: 'function_call_output',
            output: '{"ok":true,"data":{"stdout":"parallel-ok\\\\n"}}'
          }
        ]
      }
    });

    expect(pretty).toContain('"output": {');
    expect(pretty).toContain('"ok": true');
    expect(pretty).toContain('"stdout": "parallel-ok\\\\n"');
  });

  it('highlights json syntax for inspector rendering', () => {
    const highlighted = highlightJsonSyntax('{\n  "ok": true,\n  "count": 2,\n  "data": null\n}');
    expect(highlighted).toContain('json-key');
    expect(highlighted).toContain('json-boolean');
    expect(highlighted).toContain('json-number');
    expect(highlighted).toContain('json-null');
  });
});
