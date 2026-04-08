import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import { setupRoutes } from './api/routes';
import { setupWebSocket } from './websocket';
import { initDatabase } from './db';
import { initPriceSimulator } from './services/trading/price-simulator';
import { initEventScheduler } from './services/event/event-service';

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Database
  const db = initDatabase();
  fastify.decorate('db', db);

  // Price Simulator
  initPriceSimulator(db);

  // REST API
  setupRoutes(fastify);

  // Socket.io
  const io = new SocketServer(fastify.server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
  });
  setupWebSocket(io);
  fastify.decorate('io', io);

  // Event Scheduler (10 minutes for testing, change to 30 minutes in production)
  const eventIntervalMs = process.env.NODE_ENV === 'production' ? 30 * 60 * 1000 : 10 * 60 * 1000;
  initEventScheduler(io, eventIntervalMs);

  // Start
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`🎮 Tiny Traders server running on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
