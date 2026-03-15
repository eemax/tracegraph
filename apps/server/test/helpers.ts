import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';

export async function withTempDir(prefix: string, run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function createConfig(dir: string, logPath: string, extraSources: Array<{ id: string; label: string; path: string; color?: string }> = []): Promise<string> {
  const configPath = path.join(dir, 'tracegraph.config.yaml');
  const sources = [
    {
      id: 'source-a',
      label: 'Source A',
      path: logPath
    },
    ...extraSources
  ];

  const yaml = [
    'server:',
    '  host: 0.0.0.0',
    '  port: 4317',
    'sources:',
    ...sources.flatMap((source) => {
      const lines = [
        `  - id: ${source.id}`,
        `    label: ${source.label}`,
        `    path: ${source.path}`
      ];
      if (source.color) {
        lines.push(`    color: ${source.color}`);
      }
      return lines;
    })
  ].join('\n');

  await writeFile(configPath, yaml, 'utf8');
  return configPath;
}

export function makeEvent(seq: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `e-${seq}`,
    seq,
    sourceId: String(overrides.sourceId ?? 'source-a'),
    sourceLabel: String(overrides.sourceLabel ?? 'Source A'),
    line: Number(overrides.line ?? seq),
    offset: Number(overrides.offset ?? seq * 10),
    ingestedAt: String(overrides.ingestedAt ?? `2026-03-13T03:46:${String(seq).padStart(2, '0')}.000Z`),
    timestamp: String(overrides.timestamp ?? `2026-03-13T03:46:${String(seq).padStart(2, '0')}.000Z`),
    event: String(overrides.event ?? 'tool.workflow.progress'),
    stage: typeof overrides.stage === 'string' ? overrides.stage : 'completed',
    chatId: typeof overrides.chatId === 'string' ? overrides.chatId : 'chat-1',
    messageId: typeof overrides.messageId === 'string' ? overrides.messageId : 'm-1',
    senderId: typeof overrides.senderId === 'string' ? overrides.senderId : 'user-1',
    trace:
      overrides.trace === null
        ? undefined
        : {
            traceId: String((overrides.trace as { traceId?: string } | undefined)?.traceId ?? 'trace-1'),
            spanId: String((overrides.trace as { spanId?: string } | undefined)?.spanId ?? `span-${seq}`),
            parentSpanId: (overrides.trace as { parentSpanId?: string | null } | undefined)?.parentSpanId ?? null,
            origin: String((overrides.trace as { origin?: string } | undefined)?.origin ?? 'tool')
          },
    raw: {
      timestamp: String(overrides.timestamp ?? `2026-03-13T03:46:${String(seq).padStart(2, '0')}.000Z`),
      event: String(overrides.event ?? 'tool.workflow.progress'),
      stage: typeof overrides.stage === 'string' ? overrides.stage : 'completed',
      trace: {
        traceId: String((overrides.trace as { traceId?: string } | undefined)?.traceId ?? 'trace-1'),
        spanId: String((overrides.trace as { spanId?: string } | undefined)?.spanId ?? `span-${seq}`),
        parentSpanId: (overrides.trace as { parentSpanId?: string | null } | undefined)?.parentSpanId ?? null,
        origin: String((overrides.trace as { origin?: string } | undefined)?.origin ?? 'tool')
      },
      chatId: typeof overrides.chatId === 'string' ? overrides.chatId : 'chat-1',
      payload: overrides.payload ?? { message: 'default payload' }
    }
  };
}
