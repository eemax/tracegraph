import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..', '..');
const outPath = path.join(root, 'tests', 'fixtures', 'observability.load.100k.jsonl');
const total = 100_000;

const lines: string[] = [];
for (let i = 1; i <= total; i += 1) {
  lines.push(
    JSON.stringify({
      timestamp: new Date(1773373600000 + i * 5).toISOString(),
      event: i % 2 === 0 ? 'tool.workflow.progress' : 'provider.openai.request.started',
      stage: i % 3 === 0 ? 'started' : 'completed',
      chatId: `chat_${Math.floor(i / 50)}`,
      trace: {
        traceId: `trace_${Math.floor(i / 20)}`,
        spanId: `span_${i}`,
        parentSpanId: i > 1 ? `span_${i - 1}` : null,
        origin: i % 2 === 0 ? 'tool' : 'provider'
      },
      payload: {
        index: i,
        message: `synthetic fixture event ${i}`
      }
    })
  );
}

await writeFile(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`wrote ${total} events to ${outPath}`);
