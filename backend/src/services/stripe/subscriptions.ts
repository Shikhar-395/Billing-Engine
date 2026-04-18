import { getStripe } from '../../config/stripe';
import { getPrisma } from '../../config/prisma';
import { getOrCreateStripeCustomer } from './customers';

/**
 * Stripe subscription management.
 */

/**
 * Creates a Stripe subscription for a tenant + plan.
 * Returns the Stripe subscription ID.
 */
export async function createStripeSubscription(
  tenantId: string,
  stripePriceId: string,
  trialDays?: number
): Promise<string> {
  const stripe = getStripe();

  const customerId = await getOrCreateStripeCustomer(tenantId);

  const subParams: any = {
    customer: customerId,
    items: [{ price: stripePriceId }],
    metadata: { tenantId },
  };

  if (trialDays && trialDays > 0) {
    subParams.trial_period_days = trialDays;
  }

  const subscription = await stripe.subscriptions.create(subParams);
  console.log(`💳 Stripe subscription created: ${subscription.id}`);

  return subscription.id;
}

/**
 * Cancels a Stripe subscription.
 */
export async function cancelStripeSubscription(
  stripeSubId: string,
  cancelImmediately = false
): Promise<void> {
  const stripe = getStripe();

  if (cancelImmediately) {
    await stripe.subscriptions.cancel(stripeSubId);
  } else {
    await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
    });
  }

  console.log(`💳 Stripe subscription cancelled: ${stripeSubId}`);
}

/**
 * Updates a Stripe subscription (e.g., on plan upgrade).
 */
export async function updateStripeSubscription(
  stripeSubId: string,
  newStripePriceId: string
): Promise<void> {
  const stripe = getStripe();

  const subscription = await stripe.subscriptions.retrieve(stripeSubId);
  const itemId = subscription.items.data[0]?.id;

  if (!itemId) {
    throw new Error('No subscription items found');
  }

  await stripe.subscriptions.update(stripeSubId, {
    items: [
      {
        id: itemId,
        price: newStripePriceId,
      },
    ],
    proration_behavior: 'none', // We handle proration ourselves
  });

  console.log(`💳 Stripe subscription updated: ${stripeSubId}`);
}
