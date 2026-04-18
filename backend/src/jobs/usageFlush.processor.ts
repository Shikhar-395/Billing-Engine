import { Job } from 'bullmq';
import { flushUsageToDatabase } from '../services/metering/flusher';
import { UsageFlushJobData } from '../types';

/**
 * Usage flush processor.
 * Runs every 60 seconds as a repeatable BullMQ job.
 * Reads all Redis usage counters → bulk inserts to Postgres → atomic cleanup.
 */
export async function processUsageFlush(job: Job<UsageFlushJobData>): Promise<number> {
  console.log(`📊 Usage flush job started at ${job.data.triggeredAt}`);
  const count = await flushUsageToDatabase();
  return count;
}
