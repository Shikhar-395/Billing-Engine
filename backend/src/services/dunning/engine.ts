import { getPrisma } from '../../config/prisma';
import { dunningQueue } from '../../config/queues';
import { DunningStatus } from '@prisma/client';
import { transitionSubscription } from '../subscription/manager';
import { dispatchWebhookEvent } from '../webhook/dispatcher';
import { NotFoundError } from '../../utils/errors';

/**
 * Dunning engine — handles failed payment recovery.
 *
 * Retry schedule:
 *   Attempt 1 → +1 day   (86400000 ms)
 *   Attempt 2 → +3 days  (259200000 ms)
 *   Attempt 3 → +7 days  (604800000 ms)
 *
 * After 3 exhausted attempts:
 *   → Subscription.status = CANCELLED
 *   → Fire subscription.cancelled webhook
 */

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [
  1 * 24 * 60 * 60 * 1000, // 1 day
  3 * 24 * 60 * 60 * 1000, // 3 days
  7 * 24 * 60 * 60 * 1000, // 7 days
];

/**
 * Initiates dunning for a subscription after a payment failure.
 */
export async function initiateDunning(subscriptionId: string): Promise<void> {
  const prisma = getPrisma();

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!subscription) throw new NotFoundError('Subscription', subscriptionId);

  // Transition to PAST_DUE
  await transitionSubscription(subscriptionId, 'PAST_DUE');

  // Create first dunning attempt
  const attempt = await prisma.dunningAttempt.create({
    data: {
      subscriptionId,
      attemptNumber: 1,
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + RETRY_DELAYS_MS[0]),
    },
  });

  // Enqueue BullMQ delayed job
  await dunningQueue().add(
    'retry-payment',
    {
      subscriptionId,
      attemptNumber: 1,
      dunningAttemptId: attempt.id,
    },
    {
      delay: RETRY_DELAYS_MS[0],
      jobId: `dunning-${subscriptionId}-1`,
    }
  );

  // Fire webhook
  await dispatchWebhookEvent(subscription.tenantId, 'dunning.started', {
    subscriptionId,
    attemptNumber: 1,
    scheduledAt: attempt.scheduledAt,
  });

  console.log(`⚠️  Dunning initiated for subscription ${subscriptionId}, attempt 1 scheduled`);
}

/**
 * Processes a dunning retry attempt.
 * Called by the BullMQ dunning worker.
 */
export async function processDunningAttempt(
  subscriptionId: string,
  attemptNumber: number,
  dunningAttemptId: string
): Promise<{ success: boolean; nextAttempt?: number }> {
  const prisma = getPrisma();

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription) throw new NotFoundError('Subscription', subscriptionId);

  // Mark attempt as ATTEMPTED
  await prisma.dunningAttempt.update({
    where: { id: dunningAttemptId },
    data: { status: 'ATTEMPTED', executedAt: new Date() },
  });

  // Attempt charge via Stripe (placeholder — actual Stripe call in stripe service)
  let paymentSucceeded = false;
  try {
    // In real impl: call Stripe to retry the charge
    // const charge = await stripe.paymentIntents.create(...)
    // paymentSucceeded = charge.status === 'succeeded';

    // For now, default to failed (will be replaced with actual Stripe logic)
    paymentSucceeded = false;
  } catch (err) {
    paymentSucceeded = false;
  }

  if (paymentSucceeded) {
    // Recovery succeeded
    await prisma.dunningAttempt.update({
      where: { id: dunningAttemptId },
      data: { status: 'SUCCEEDED' },
    });

    // Transition back to ACTIVE
    await transitionSubscription(subscriptionId, 'ACTIVE');

    console.log(`✅ Dunning recovery succeeded for subscription ${subscriptionId}`);
    return { success: true };
  }

  // Payment failed
  await prisma.dunningAttempt.update({
    where: { id: dunningAttemptId },
    data: {
      status: 'FAILED',
      failureReason: 'Payment retry failed',
    },
  });

  // Check if we've exhausted all attempts
  if (attemptNumber >= MAX_ATTEMPTS) {
    // Mark as exhausted
    await prisma.dunningAttempt.update({
      where: { id: dunningAttemptId },
      data: { status: 'EXHAUSTED' },
    });

    // Cancel subscription
    await transitionSubscription(subscriptionId, 'CANCELLED');

    // Fire webhook
    await dispatchWebhookEvent(subscription.tenantId, 'dunning.exhausted', {
      subscriptionId,
      totalAttempts: attemptNumber,
    });

    // Also fire subscription.cancelled
    await dispatchWebhookEvent(subscription.tenantId, 'subscription.cancelled', {
      subscriptionId,
      reason: 'dunning_exhausted',
    });

    console.log(`❌ Dunning exhausted for subscription ${subscriptionId} — cancelled`);
    return { success: false };
  }

  // Schedule next attempt
  const nextAttemptNumber = attemptNumber + 1;
  const nextDelay = RETRY_DELAYS_MS[nextAttemptNumber - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

  const nextAttempt = await prisma.dunningAttempt.create({
    data: {
      subscriptionId,
      attemptNumber: nextAttemptNumber,
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + nextDelay),
    },
  });

  await dunningQueue().add(
    'retry-payment',
    {
      subscriptionId,
      attemptNumber: nextAttemptNumber,
      dunningAttemptId: nextAttempt.id,
    },
    {
      delay: nextDelay,
      jobId: `dunning-${subscriptionId}-${nextAttemptNumber}`,
    }
  );

  console.log(
    `⚠️  Dunning attempt ${attemptNumber} failed for subscription ${subscriptionId}, attempt ${nextAttemptNumber} scheduled`
  );

  return { success: false, nextAttempt: nextAttemptNumber };
}
