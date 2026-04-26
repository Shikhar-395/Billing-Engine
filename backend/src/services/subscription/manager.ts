import { getPrisma } from '../../config/prisma.js';
import { SubscriptionStatus, BillingInterval } from '@prisma/client';
import { assertTransition } from './lifecycle.js';
import { calculateProration, ProrationResult } from '../billing/proration.js';
import { computeProrationCharge } from '../billing/chargeCalculator.js';
import { addMonths, addYears } from '../../utils/dates.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { dispatchWebhookEvent } from '../webhook/dispatcher.js';

/**
 * Subscription manager — handles create, upgrade, cancel, renew.
 */

export interface CreateSubscriptionInput {
  tenantId: string;
  customerId: string;
  planId: string;
  trialDays?: number;
  stripeSubId?: string;
}

export interface UpgradeSubscriptionResult {
  subscription: any;
  proration: ProrationResult;
  prorationLineItem: any;
}

/**
 * Creates a new subscription.
 */
export async function createSubscription(input: CreateSubscriptionInput) {
  const prisma = getPrisma();
  const { tenantId, customerId, planId, trialDays = 0, stripeSubId } = input;

  const plan = await prisma.plan.findFirst({
    where: {
      id: planId,
      tenantId,
    },
  });
  if (!plan) throw new NotFoundError('Plan', planId);
  if (!plan.isActive) throw new ConflictError('Plan is inactive');

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId,
      status: 'ACTIVE',
    },
  });
  if (!customer) throw new NotFoundError('Customer', customerId);

  // Check for existing active subscription for this customer
  const existing = await prisma.subscription.findFirst({
    where: {
      customerId,
      status: { in: ['TRIALING', 'ACTIVE'] },
    },
  });
  if (existing) {
    throw new ConflictError('Customer already has an active subscription');
  }

  const now = new Date();
  const periodEnd =
    plan.interval === 'MONTHLY' ? addMonths(now, 1) : addYears(now, 1);

  const status: SubscriptionStatus = trialDays > 0 ? 'TRIALING' : 'ACTIVE';
  const trialEndsAt = trialDays > 0
    ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
    : null;

  const subscription = await prisma.subscription.create({
    data: {
      tenantId,
      customerId,
      planId,
      stripeSubId,
      status,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
    },
    include: { plan: true },
  });

  // Fire webhook
  await dispatchWebhookEvent(tenantId, 'subscription.created', {
    subscriptionId: subscription.id,
    customerId: customer.id,
    customerName: customer.name,
    planId: plan.id,
    planName: plan.name,
    status: subscription.status,
  });

  return subscription;
}

/**
 * Upgrades a subscription to a new plan with mid-cycle proration.
 */
export async function upgradeSubscription(
  subscriptionId: string,
  newPlanId: string
): Promise<UpgradeSubscriptionResult> {
  const prisma = getPrisma();

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) throw new NotFoundError('Subscription', subscriptionId);
  if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIALING') {
    throw new ConflictError(`Cannot upgrade subscription in ${subscription.status} status`);
  }

  const newPlan = await prisma.plan.findUnique({ where: { id: newPlanId } });
  if (!newPlan) throw new NotFoundError('Plan', newPlanId);
  if (!newPlan.isActive) throw new ConflictError('Target plan is inactive');

  const oldPlan = subscription.plan;
  const oldPrice = oldPlan.interval === 'MONTHLY' ? oldPlan.priceMonthly : oldPlan.priceYearly;
  const newPrice = newPlan.interval === 'MONTHLY' ? newPlan.priceMonthly : newPlan.priceYearly;

  // Calculate proration
  const proration = calculateProration({
    oldPlanPrice: oldPrice,
    newPlanPrice: newPrice,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    changeDate: new Date(),
  });

  // Update subscription
  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { planId: newPlanId },
    include: { plan: true, customer: true },
  });

  // Create proration line item on the latest invoice (if any)
  const prorationLineItem = computeProrationCharge(
    proration.prorationAmount,
    oldPlan.name,
    newPlan.name,
    proration.daysRemainingInPeriod,
    proration.totalDaysInPeriod
  );

  // Fire webhook
  await dispatchWebhookEvent(subscription.tenantId, 'subscription.upgraded', {
    subscriptionId: subscription.id,
    customerId: updated.customerId,
    customerName: updated.customer.name,
    oldPlanId: oldPlan.id,
    oldPlanName: oldPlan.name,
    newPlanId: newPlan.id,
    newPlanName: newPlan.name,
    prorationAmount: proration.prorationAmount,
  });

  return {
    subscription: updated,
    proration,
    prorationLineItem,
  };
}

/**
 * Cancels a subscription.
 */
export async function cancelSubscription(subscriptionId: string) {
  const prisma = getPrisma();

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) throw new NotFoundError('Subscription', subscriptionId);
  assertTransition(subscription.status, 'CANCELLED');

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
    include: { plan: true, customer: true },
  });

  // Fire webhook
  await dispatchWebhookEvent(subscription.tenantId, 'subscription.cancelled', {
    subscriptionId: subscription.id,
    customerId: updated.customerId,
    customerName: updated.customer.name,
    planId: subscription.planId,
    cancelledAt: updated.cancelledAt,
  });

  return updated;
}

/**
 * Transitions subscription status (used by dunning, Stripe webhooks, etc.)
 */
export async function transitionSubscription(
  subscriptionId: string,
  newStatus: SubscriptionStatus
) {
  const prisma = getPrisma();

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) throw new NotFoundError('Subscription', subscriptionId);
  assertTransition(subscription.status, newStatus);

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: newStatus,
      ...(newStatus === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
    },
  });
}
