import { getPrisma } from '../../config/prisma.js';
import { InvoiceStatus } from '@prisma/client';
import {
  computeSubscriptionCharge,
  computeUsageCharges,
  ChargeLineItem,
} from '../billing/chargeCalculator.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { dispatchWebhookEvent } from '../webhook/dispatcher.js';

/**
 * Invoice generator — creates invoices with line items for a billing period.
 */

export interface GenerateInvoiceInput {
  subscriptionId: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  usagePricing?: Record<string, number>; // metricKey → price per unit
}

/**
 * Generates an invoice for a subscription billing period.
 */
export async function generateInvoice(input: GenerateInvoiceInput) {
  const prisma = getPrisma();
  const { subscriptionId, tenantId, periodStart, periodEnd, usagePricing = {} } = input;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) throw new NotFoundError('Subscription', subscriptionId);

  // Compute line items
  const lineItems: ChargeLineItem[] = [];

  // 1. Subscription charge
  const subCharge = computeSubscriptionCharge(
    subscription.plan.name,
    subscription.plan.priceMonthly,
    subscription.plan.priceYearly,
    subscription.plan.interval
  );
  lineItems.push(subCharge);

  // 2. Usage charges
  if (Object.keys(usagePricing).length > 0) {
    const usageCharges = await computeUsageCharges(
      tenantId,
      periodStart,
      periodEnd,
      usagePricing
    );
    lineItems.push(...usageCharges);
  }

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = 0; // Tax calculation can be added later
  const total = subtotal + tax;

  // Create invoice with line items in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        tenantId,
        subscriptionId,
        status: 'DRAFT',
        subtotal,
        tax,
        total,
        currency: subscription.plan.currency,
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      },
    });

    await tx.invoiceLineItem.createMany({
      data: lineItems.map((item) => ({
        invoiceId: inv.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        type: item.type,
      })),
    });

    return tx.invoice.findUnique({
      where: { id: inv.id },
      include: { lineItems: true },
    });
  });

  // Fire webhook
  await dispatchWebhookEvent(tenantId, 'invoice.created', {
    invoiceId: invoice!.id,
    subscriptionId,
    total,
    currency: subscription.plan.currency,
  });

  return invoice;
}

/**
 * Adds a proration line item to an existing or new invoice.
 */
export async function addProrationToInvoice(
  tenantId: string,
  subscriptionId: string,
  lineItem: ChargeLineItem
) {
  const prisma = getPrisma();

  // Find or create a DRAFT invoice for the subscription
  let invoice = await prisma.invoice.findFirst({
    where: {
      subscriptionId,
      status: 'DRAFT',
    },
  });

  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId,
        status: 'DRAFT',
        subtotal: 0,
        tax: 0,
        total: 0,
        currency: 'INR',
      },
    });
  }

  // Add the proration line item
  await prisma.invoiceLineItem.create({
    data: {
      invoiceId: invoice.id,
      description: lineItem.description,
      quantity: lineItem.quantity,
      unitPrice: lineItem.unitPrice,
      amount: lineItem.amount,
      type: lineItem.type,
    },
  });

  // Recalculate totals
  const allLineItems = await prisma.invoiceLineItem.findMany({
    where: { invoiceId: invoice.id },
  });

  const subtotal = allLineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal + invoice.tax;

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { subtotal, total },
    include: { lineItems: true },
  });
}
