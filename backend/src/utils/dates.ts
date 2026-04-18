/**
 * Date utilities for proration calculations and usage metering windows.
 * All calculations assume UTC.
 */

/**
 * Returns total days in a billing period.
 */
export function daysInPeriod(periodStart: Date, periodEnd: Date): number {
  const ms = periodEnd.getTime() - periodStart.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Returns remaining days from `fromDate` to `periodEnd`.
 */
export function daysRemaining(fromDate: Date, periodEnd: Date): number {
  const ms = periodEnd.getTime() - fromDate.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Generates a window key for usage metering.
 * Format: YYYY-MM-DD-HH (hourly buckets)
 */
export function windowKey(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${hh}`;
}

/**
 * Returns the start of the current hour (UTC).
 */
export function windowStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

/**
 * Returns the end of the current hour (UTC).
 */
export function windowEnd(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCMinutes(59, 59, 999);
  return d;
}

/**
 * Adds months to a date (for billing period computation).
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Adds years to a date.
 */
export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}
