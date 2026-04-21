import { createApp } from './app.js';
import { env } from './config/env.js';
import { getRedis, closeRedis } from './config/redis.js';
import { closePrisma } from './config/prisma.js';
import { closeQueues } from './config/queues.js';
import { startWorkers, stopWorkers } from './jobs/workers.js';

/**
 * HTTP server entry point.
 * Starts Express + BullMQ workers.
 * Handles graceful shutdown of all connections.
 */

async function main() {
  const app = createApp();

  // Initialize Redis (ensures connection before starting)
  getRedis();

  // Start BullMQ workers
  await startWorkers();

  // Start Express server
  const server = app.listen(env.PORT, () => {
    console.log(`
┌─────────────────────────────────────────────────┐
│                                                 │
│   🚀 Billing Engine API                        │
│   Running on http://localhost:${env.PORT}            │
│   Environment: ${env.NODE_ENV}                      │
│                                                 │
│   Routes:                                       │
│   ├─ POST   /api/v1/tenants                     │
│   ├─ GET    /api/v1/plans                       │
│   ├─ POST   /api/v1/subscriptions               │
│   ├─ POST   /api/v1/usage                       │
│   ├─ GET    /api/v1/invoices                    │
│   ├─ GET    /api/v1/payments                    │
│   ├─ POST   /api/v1/webhooks/endpoints          │
│   ├─ POST   /api/v1/stripe/webhook              │
│   ├─ GET    /api/v1/audit-logs                  │
│   └─ GET    /health                             │
│                                                 │
│   Workers:                                      │
│   ├─ usage-flush   (every 60s)                  │
│   ├─ dunning       (on demand)                  │
│   └─ webhook-delivery (on demand)               │
│                                                 │
└─────────────────────────────────────────────────┘
    `);
  });

  // ── Graceful Shutdown ──────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n📋 ${signal} received. Starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(() => {
      console.log('🔌 HTTP server closed');
    });

    // 2. Stop BullMQ workers (let in-progress jobs finish)
    await stopWorkers();

    // 3. Close BullMQ queues
    await closeQueues();

    // 4. Close Redis
    await closeRedis();

    // 5. Close Prisma
    await closePrisma();

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Unhandled errors
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
