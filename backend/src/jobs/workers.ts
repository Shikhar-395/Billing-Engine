import { Worker } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { usageFlushQueue } from '../config/queues.js';
import { processUsageFlush } from './usageFlush.processor.js';
import { processDunning } from './dunning.processor.js';
import { processWebhookDelivery } from './webhookDelivery.processor.js';

/**
 * BullMQ workers initialization.
 * All workers run in the same process for development.
 * For production, split into separate processes.
 */

let workers: Worker[] = [];

export async function startWorkers(): Promise<void> {
  const connection = getRedis();

  // ── Usage Flush Worker ─────────────────────────────────
  const usageFlushWorker = new Worker(
    'usage-flush',
    async (job) => processUsageFlush(job),
    {
      connection,
      concurrency: 1, // Single concurrent flush
    }
  );

  // Register repeatable job (every 60 seconds)
  await usageFlushQueue().add(
    'flush',
    { triggeredAt: new Date().toISOString() },
    {
      repeat: { every: 60000 }, // 60 seconds
      jobId: 'usage-flush-cron',
    }
  );

  usageFlushWorker.on('completed', (job) => {
    console.log(`📊 Usage flush completed: ${job?.returnvalue} records`);
  });

  usageFlushWorker.on('failed', (job, err) => {
    console.error(`📊 Usage flush failed:`, err.message);
  });

  // ── Dunning Worker ─────────────────────────────────────
  const dunningWorker = new Worker(
    'dunning',
    async (job) => processDunning(job),
    {
      connection,
      concurrency: 5,
    }
  );

  dunningWorker.on('completed', (job) => {
    console.log(`⚠️  Dunning job completed:`, job?.returnvalue);
  });

  dunningWorker.on('failed', (job, err) => {
    console.error(`⚠️  Dunning job failed:`, err.message);
  });

  // ── Webhook Delivery Worker ────────────────────────────
  const webhookDeliveryWorker = new Worker(
    'webhook-delivery',
    async (job) => processWebhookDelivery(job),
    {
      connection,
      concurrency: 10,
    }
  );

  webhookDeliveryWorker.on('completed', (job) => {
    console.log(`📤 Webhook delivery completed: ${job?.data?.endpointUrl}`);
  });

  webhookDeliveryWorker.on('failed', (job, err) => {
    console.error(`📤 Webhook delivery failed:`, err.message);
  });

  workers = [usageFlushWorker, dunningWorker, webhookDeliveryWorker];
  console.log('✅ BullMQ workers started: usage-flush, dunning, webhook-delivery');
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
  console.log('🔌 BullMQ workers stopped');
}
