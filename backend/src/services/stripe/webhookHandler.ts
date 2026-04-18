import Stripe from 'stripe';
import { getRedis } from '../../config/redis';
import { getPrisma } from '../../config/prisma';
import { transitionSubscription } from '../subscription/manager';
import { markInvoicePaid } from '../invoice/manager';
import { initiateDunning } from '../dunning/engine';

/**
 * Idempotent Stripe webhook handler.
 *
 * 1. SET stripe:event:{id} 1 EX 86400 NX → if null, already processed → return 200
 * 2. Route event to appropriate handler
 * 3. On processing failure, delete Redis key to allow retry
 */

/**
 * Processes a Stripe webhook event idempotently.
 * Returns true if the event was processed, false if it was a duplicate.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<boolean> {
  const redis = getRedis();
  const eventKey = `stripe:event:${event.id}`;

  // Idempotency check — SET NX with 24h TTL
  const result = await redis.set(eventKey, '1', 'EX', 86400, 'NX');

  if (result === null) {
    // Already processed — return immediately
    console.log(`🔁 Duplicate Stripe event ignored: ${event.id} (${event.type})`);
    return false;
  }

  try {
    await routeStripeEvent(event);
    console.log(`✅ Stripe event processed: ${event.id} (${event.type})`);
    return true;
  } catch (err) {
    // Delete Redis key so the event can be retried
    await redis.del(eventKey);
    console.error(`❌ Stripe event processing failed: ${event.id} (${event.type})`, err);
    throw err;
  }
}

/**
 * Routes a Stripe event to the appropriate handler.
 */
async function routeStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'invoice.paid':
      await handleInvoicePaid(event);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event);
      break;

    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event);
      break;

    default:
      console.log(`ℹ️  Unhandled Stripe event type: ${event.type}`);
  }
}

// ── Event Handlers ───────────────────────────────────────

async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const prisma = getPrisma();
  const stripeInvoice = event.data.object as Stripe.Invoice;

  const invoice = await prisma.invoice.findUnique({
    where: { stripeInvoiceId: stripeInvoice.id },
  });

  if (invoice) {
    await markInvoicePaid(invoice.id);
  }
}

async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const prisma = getPrisma();
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const stripeSubId = stripeInvoice.subscription as string;

  if (!stripeSubId) return;

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubId },
  });

  if (subscription && subscription.status === 'ACTIVE') {
    await initiateDunning(subscription.id);
  }
}

async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const prisma = getPrisma();
  const stripeSub = event.data.object as Stripe.Subscription;

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubId: stripeSub.id },
  });

  if (!subscription) return;

  // Sync period dates
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const stripeSub = event.data.object as Stripe.Subscription;

  const prisma = getPrisma();
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubId: stripeSub.id },
  });

  if (subscription && subscription.status !== 'CANCELLED') {
    await transitionSubscription(subscription.id, 'CANCELLED');
  }
}

async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
  const prisma = getPrisma();
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: {
      status: 'SUCCEEDED',
      processedAt: new Date(),
    },
  });
}

async function handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
  const prisma = getPrisma();
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  await prisma.payment.updateMany({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: {
      status: 'FAILED',
      processedAt: new Date(),
    },
  });
}
