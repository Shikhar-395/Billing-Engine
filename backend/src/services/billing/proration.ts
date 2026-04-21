import { daysInPeriod, daysRemaining } from '../../utils/dates.js';

/**
 * Mid-cycle proration calculator.
 *
 * When a tenant upgrades from Plan A to Plan B mid-cycle:
 *   credit = planA.price × (daysRemaining / totalDays)
 *   charge = planB.price × (daysRemaining / totalDays)
 *   prorationAmount = charge - credit
 *
 * All amounts are in integer paise/cents. Division only at display time.
 */

export interface ProrationInput {
  oldPlanPrice: number; // in paise/cents
  newPlanPrice: number; // in paise/cents
  periodStart: Date;
  periodEnd: Date;
  changeDate: Date; // when the upgrade happens
}

export interface ProrationResult {
  credit: number; // amount to credit for unused old plan (paise)
  charge: number; // amount to charge for new plan remainder (paise)
  prorationAmount: number; // net charge (charge - credit), can be negative for downgrades
  daysRemainingInPeriod: number;
  totalDaysInPeriod: number;
}

export function calculateProration(input: ProrationInput): ProrationResult {
  const { oldPlanPrice, newPlanPrice, periodStart, periodEnd, changeDate } = input;

  const totalDays = daysInPeriod(periodStart, periodEnd);
  const remaining = daysRemaining(changeDate, periodEnd);

  if (totalDays <= 0) {
    return {
      credit: 0,
      charge: 0,
      prorationAmount: 0,
      daysRemainingInPeriod: 0,
      totalDaysInPeriod: 0,
    };
  }

  // Integer math: multiply first, then divide to minimize rounding errors
  const credit = Math.floor((oldPlanPrice * remaining) / totalDays);
  const charge = Math.floor((newPlanPrice * remaining) / totalDays);
  const prorationAmount = charge - credit;

  return {
    credit,
    charge,
    prorationAmount,
    daysRemainingInPeriod: remaining,
    totalDaysInPeriod: totalDays,
  };
}

/**
 * Formats an integer amount (paise) to a display string.
 * Example: 150075 → "1,500.75"
 */
export function formatAmount(amountPaise: number, currency = 'INR'): string {
  const major = Math.floor(amountPaise / 100);
  const minor = amountPaise % 100;
  const symbol = currency === 'INR' ? '₹' : '$';
  return `${symbol}${major.toLocaleString()}.${String(minor).padStart(2, '0')}`;
}
