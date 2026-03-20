import path from 'node:path';
import { access } from 'node:fs/promises';
import { Elysia } from 'elysia';
import type { EventFilterQuery, EventListResponse, SseEnvelope } from '@tracegraph/shared';
import { loadConfig, type TracegraphConfig } from './config';
import { EventStore } from './event-store';
import { LogIngestionService } from './log-ingestion';
import { SseHub } from './sse-hub';

interface ServerOptions {
  configPath?: string;
  webBuildDir?: string;
  autoStartIngestion?: boolean;
}

interface ServerContext {
  app: Elysia;
  config: TracegraphConfig;
  store: EventStore;
  hub: SseHub;
  ingestion: LogIngestionService;
}

function sendSse(controller: ReadableStreamDefaultController<Uint8Array>, envelope: SseEnvelope): void {
  const payload = `event: message\ndata: ${JSON.stringify(envelope)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

function parseQuery(query: Record<string, unknown>): EventFilterQuery {
  const rawEventType = query.eventType;
  const parsedEventType =
    typeof rawEventType === 'string'
      ? rawEventType
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : Array.isArray(rawEventType)
        ? rawEventType
            .filter((value): value is string => typeof value === 'string')
            .flatMap((value) => value.split(','))
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined;

  return {
    cursor: typeof query.cursor === 'string' ? query.cursor : undefined,
    limit: typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    eventType: parsedEventType,
    event: typeof query.event === 'string' ? query.event : undefined,
    stage: typeof query.stage === 'string' ? query.stage : undefined,
    origin: typeof query.origin === 'string' ? query.origin : undefined,
    traceId: typeof query.traceId === 'string' ? query.traceId : undefined,
    chatId: typeof query.chatId === 'string' ? query.chatId : undefined,
    q: typeof query.q === 'string' ? query.q : undefined
  };
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function createServer(options: ServerOptions = {}): Promise<ServerContext> {
  const config = await loadConfig(options.configPath);
  const store = new EventStore(100_000);
  const hub = new SseHub();
  const ingestion = new LogIngestionService(config, store, hub, 1000);
  const app = new Elysia();

  app.get('/api/health', () => ({
    ok: true,
    now: new Date().toISOString(),
    events: store.size,
    dropped: store.droppedCount,
    sources: ingestion.getStatuses()
  }));

  app.get('/api/sources', () => ({
    items: config.sources.map((source) => ({
      id: source.id,
      label: source.label,
      path: source.path,
      color: source.color
    })),
    statuses: ingestion.getStatuses()
  }));

  app.get('/api/events', ({ query }) => {
    const response: EventListResponse = store.query(parseQuery(query as Record<string, unknown>));
    return response;
  });

  app.get('/api/events/:id', ({ params, set }) => {
    const event = store.getById(params.id);
    if (!event) {
      set.status = 404;
      return { item: null };
    }
    return { item: event };
  });

  app.get('/api/stream', ({ request }) => {
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const unsubscribe = hub.subscribe((envelope) => sendSse(controller, envelope));

        sendSse(controller, {
          type: 'snapshot',
          payload: {
            items: store.getLatest(200),
            total: store.size,
            dropped: store.droppedCount,
            sources: ingestion.getStatuses()
          }
        });

        const heartbeat = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        }, 15_000);

        const cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // stream already closed
          }
        };

        request.signal.addEventListener('abort', cleanup);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    });
  });

  const webBuildDir = options.webBuildDir ?? path.resolve(process.cwd(), '../web/build');
  const indexPath = path.join(webBuildDir, 'index.html');

  app.get('/', async ({ set }) => {
    if (await fileExists(indexPath)) {
      return new Response(Bun.file(indexPath));
    }

    set.status = 404;
    return { error: 'Web build not found. Run bun run --cwd apps/web build.' };
  });

  app.get('/*', async ({ params, set }) => {
    const requestPath = String(params['*'] ?? '');
    if (requestPath.startsWith('api/')) {
      set.status = 404;
      return { error: 'Not found' };
    }

    const assetPath = path.resolve(webBuildDir, requestPath);
    const buildRoot = path.resolve(webBuildDir);

    if (!assetPath.startsWith(buildRoot)) {
      set.status = 403;
      return { error: 'Forbidden' };
    }

    if (await fileExists(assetPath)) {
      return new Response(Bun.file(assetPath));
    }

    if (await fileExists(indexPath)) {
      return new Response(Bun.file(indexPath));
    }

    set.status = 404;
    return { error: 'Not found' };
  });

  if (options.autoStartIngestion ?? true) {
    await ingestion.start();
  }

  return {
    app,
    config,
    store,
    hub,
    ingestion
  };
}
