import { Job } from 'bullmq';
import { processDunningAttempt } from '../services/dunning/engine.js';
import type { DunningJobData } from '../types/index.js';

/**
 * Dunning processor.
 * Processes retry-payment jobs with escalating delays.
 * On exhaustion after 3 attempts, cancels the subscription.
 */
export async function processDunning(
  job: Job<DunningJobData>
): Promise<{ success: boolean; nextAttempt?: number }> {
  const { subscriptionId, attemptNumber, dunningAttemptId } = job.data;

  console.log(
    `⚠️  Dunning attempt ${attemptNumber} for subscription ${subscriptionId}`
  );

  return processDunningAttempt(subscriptionId, attemptNumber, dunningAttemptId);
}
