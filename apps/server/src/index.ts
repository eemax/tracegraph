import { createServer } from './lib/http';

const server = await createServer({
  autoStartIngestion: true
});

server.app.listen({
  hostname: server.config.server.host,
  port: server.config.server.port
});

console.log(
  `[tracegraph] listening on http://${server.config.server.host}:${server.config.server.port} with ${server.config.sources.length} source(s)`
);

const shutdown = () => {
  server.ingestion.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
