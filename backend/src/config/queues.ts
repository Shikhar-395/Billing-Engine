import { Queue } from 'bullmq';
import { getRedis } from './redis.js';

let queues: Record<string, Queue> = {};

function createQueue(name: string): Queue {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queues[name];
}

// ── Queue Definitions ────────────────────────────────────
export const usageFlushQueue = () => createQueue('usage-flush');
export const dunningQueue = () => createQueue('dunning');
export const webhookDeliveryQueue = () => createQueue('webhook-delivery');
export const invoiceGenerationQueue = () => createQueue('invoice-generation');

export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
  queues = {};
  console.log('🔌 BullMQ queues closed');
}
