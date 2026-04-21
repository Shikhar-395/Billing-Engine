import { getPrisma } from '../../config/prisma.js';
import { BillingInterval } from '@prisma/client';

/**
 * Charge calculator — computes invoice line items for a billing period.
 */

export interface ChargeLineItem {
  description: string;
  quantity: number;
  unitPrice: number; // paise/cents
  amount: number; // paise/cents
  type: 'SUBSCRIPTION' | 'USAGE' | 'PRORATION' | 'TAX' | 'DISCOUNT';
}

/**
 * Computes the subscription line item for a plan.
 */
export function computeSubscriptionCharge(
  planName: string,
  priceMonthly: number,
  priceYearly: number,
  interval: BillingInterval
): ChargeLineItem {
  const unitPrice = interval === 'MONTHLY' ? priceMonthly : priceYearly;
  return {
    description: `${planName} — ${interval.toLowerCase()} subscription`,
    quantity: 1,
    unitPrice,
    amount: unitPrice,
    type: 'SUBSCRIPTION',
  };
}

/**
 * Computes usage-based line items by aggregating UsageRecords for the period.
 */
export async function computeUsageCharges(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
  usagePricing: Record<string, number> // metricKey → price per unit (paise)
): Promise<ChargeLineItem[]> {
  const prisma = getPrisma();

  const usageRecords = await prisma.usageRecord.groupBy({
    by: ['metricKey'],
    where: {
      tenantId,
      windowStart: { gte: periodStart },
      windowEnd: { lte: periodEnd },
    },
    _sum: { quantity: true },
  });

  return usageRecords
    .filter((r) => usagePricing[r.metricKey] !== undefined)
    .map((r) => {
      const quantity = r._sum.quantity || 0;
      const unitPrice = usagePricing[r.metricKey];
      return {
        description: `Usage: ${r.metricKey} (${quantity} units)`,
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
        type: 'USAGE' as const,
      };
    });
}

/**
 * Creates a proration line item.
 */
export function computeProrationCharge(
  prorationAmount: number,
  oldPlanName: string,
  newPlanName: string,
  daysRemaining: number,
  totalDays: number
): ChargeLineItem {
  return {
    description: `Proration: ${oldPlanName} → ${newPlanName} (${daysRemaining}/${totalDays} days)`,
    quantity: 1,
    unitPrice: prorationAmount,
    amount: prorationAmount,
    type: 'PRORATION',
  };
}
