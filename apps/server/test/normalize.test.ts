import { describe, expect, it } from 'bun:test';
import { normalizeEvent } from '../src/lib/normalize';

describe('normalizeEvent', () => {
  it('normalizes a valid raw event', () => {
    const event = normalizeEvent(
      {
        timestamp: '2026-03-13T03:46:49.053Z',
        event: 'telegram.inbound.received',
        stage: 'received',
        chatId: 'chat-1',
        trace: {
          traceId: 'trace-1',
          spanId: 'span-1',
          parentSpanId: null,
          origin: 'telegram'
        }
      },
      {
        id: 'source-a:1',
        seq: 1,
        sourceId: 'source-a',
        sourceLabel: 'Source A',
        line: 1,
        offset: 0,
        ingestedAt: '2026-03-13T03:46:49.053Z'
      }
    );

    expect(event).not.toBeNull();
    expect(event?.event).toBe('telegram.inbound.received');
    expect(event?.trace?.origin).toBe('telegram');
  });

  it('returns null when raw value is not an object', () => {
    const event = normalizeEvent('not-object', {
      id: 'source-a:1',
      seq: 1,
      sourceId: 'source-a',
      sourceLabel: 'Source A',
      line: 1,
      offset: 0,
      ingestedAt: '2026-03-13T03:46:49.053Z'
    });

    expect(event).toBeNull();
  });

  it('extracts rich derived fields from nested provider/tool workflow events', () => {
    const event = normalizeEvent(
      {
        timestamp: '2026-03-13T14:21:43.798Z',
        event: 'provider.openai.request.completed',
        stage: 'completed',
        chatId: '8512871156',
        messageId: 661,
        attempt: 1,
        maxAttempts: 3,
        status: 200,
        ok: true,
        resultType: 'reply',
        trace: {
          traceId: 'trace_01KKKS5XVT0GQWTEJT4NV4G3K0',
          spanId: 'span_01KKKS5Y4GADY5RW9GEHDSW078',
          parentSpanId: 'span_parent',
          origin: 'provider'
        },
        progress: {
          type: 'step',
          state: 'RUNNING',
          message: 'tool-loop step 1: requesting model response',
          step: 1,
          elapsedMs: 269
        },
        body: {
          model: 'gpt-5.3-codex'
        },
        payload: {
          content: 'Do a tool call and say ”hello”'
        },
        text: '⏳ [5s] tool workflow still running'
      },
      {
        id: 'source-a:2',
        seq: 2,
        sourceId: 'source-a',
        sourceLabel: 'Source A',
        line: 2,
        offset: 42,
        ingestedAt: '2026-03-13T14:21:43.800Z'
      }
    );

    expect(event).not.toBeNull();
    expect(event?.messageId).toBe('661');
    expect(event?.derived?.statusCode).toBe(200);
    expect(event?.derived?.ok).toBe(true);
    expect(event?.derived?.attempt).toBe(1);
    expect(event?.derived?.maxAttempts).toBe(3);
    expect(event?.derived?.model).toBe('gpt-5.3-codex');
    expect(event?.derived?.progressType).toBe('step');
    expect(event?.derived?.step).toBe(1);
    expect(event?.derived?.elapsedMs).toBe(269);
    expect(event?.derived?.textPreview).toContain('tool workflow still running');
  });

  it('extracts assistant text from provider response body output messages', () => {
    const event = normalizeEvent(
      {
        timestamp: '2026-03-13T15:22:44.910Z',
        event: 'provider.openai.request.completed',
        stage: 'completed',
        chatId: '8512871156',
        messageId: '667',
        body: {
          model: 'gpt-5.3-codex',
          output: [
            {
              id: 'rs_01',
              type: 'reasoning',
              summary: []
            },
            {
              id: 'msg_01',
              type: 'message',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: 'Nice - I just ran one call for each tool. Want me to do a second round?'
                }
              ]
            }
          ]
        }
      },
      {
        id: 'source-a:3',
        seq: 3,
        sourceId: 'source-a',
        sourceLabel: 'Source A',
        line: 3,
        offset: 90,
        ingestedAt: '2026-03-13T15:22:44.920Z'
      }
    );

    expect(event).not.toBeNull();
    expect(event?.derived?.model).toBe('gpt-5.3-codex');
    expect(event?.derived?.textPreview).toContain('one call for each tool');
  });

  it('extracts function-call output preview from provider request input', () => {
    const event = normalizeEvent(
      {
        timestamp: '2026-03-13T15:22:38.897Z',
        event: 'provider.openai.request.started',
        stage: 'started',
        chatId: '8512871156',
        messageId: '667',
        body: {
          model: 'gpt-5.3-codex',
          input: [
            {
              type: 'function_call_output',
              call_id: 'call_1',
              output:
                '{"ok":true,"summary":"Bash command completed successfully.","data":{"stdout":"parallel-ok\\\\n"},"meta":{"exit_code":0}}'
            },
            {
              type: 'function_call_output',
              call_id: 'call_2',
              output:
                '{"ok":true,"summary":"Read file /Users/ysera/.agent-commander/tool_demo.txt.","data":{"content":"alpha\\\\nBETA\\\\ngamma\\\\ndelta\\\\n"}}'
            }
          ]
        }
      },
      {
        id: 'source-a:4',
        seq: 4,
        sourceId: 'source-a',
        sourceLabel: 'Source A',
        line: 4,
        offset: 140,
        ingestedAt: '2026-03-13T15:22:38.910Z'
      }
    );

    expect(event).not.toBeNull();
    expect(event?.derived?.outputPreview).toContain('Bash command completed successfully');
    expect(event?.derived?.outputPreview).toContain('parallel-ok');
    expect(event?.derived?.outputPreview).toContain('alpha BETA gamma delta');
  });
});
