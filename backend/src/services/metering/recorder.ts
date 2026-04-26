import { getRedis } from '../../config/redis.js';
import { windowKey } from '../../utils/dates.js';

/**
 * Usage metering recorder.
 *
 * When a tenant makes an API call or consumes a metered resource:
 *   INCR billing:usage:{tenantId}:{metricKey}:{windowKey}
 *
 * Sub-millisecond, zero Postgres writes. The flusher handles persistence.
 */

/**
 * Records a usage event in Redis.
 * Returns the new count for the current window.
 */
export async function recordUsage(
  tenantId: string,
  customerId: string,
  metricKey: string,
  quantity: number = 1,
  subscriptionId?: string
): Promise<number> {
  const redis = getRedis();
  const wk = windowKey();
  const key = `billing:usage:${tenantId}:${customerId}:${
    subscriptionId ?? 'none'
  }:${metricKey}:${wk}`;

  // INCRBY for quantities > 1, INCR for single events
  const newValue = await redis.incrby(key, quantity);

  // Set a TTL of 2 hours — safety net in case flusher misses a window
  await redis.expire(key, 7200);

  return newValue;
}

/**
 * Gets the current usage count for a specific metric in the current window.
 */
export async function getCurrentUsage(
  tenantId: string,
  customerId: string,
  metricKey: string,
  subscriptionId?: string
): Promise<number> {
  const redis = getRedis();
  const wk = windowKey();
  const key = `billing:usage:${tenantId}:${customerId}:${
    subscriptionId ?? 'none'
  }:${metricKey}:${wk}`;
  const value = await redis.get(key);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Gets all active usage keys matching a tenant and optional metric.
 * Used by the flusher and usage summary endpoints.
 */
export async function getUsageKeys(
  tenantId?: string,
  customerId?: string,
  metricKey?: string
): Promise<string[]> {
  const redis = getRedis();
  const pattern = tenantId
    ? customerId
      ? metricKey
        ? `billing:usage:${tenantId}:${customerId}:*:${metricKey}:*`
        : `billing:usage:${tenantId}:${customerId}:*`
      : metricKey
        ? `billing:usage:${tenantId}:*:*:${metricKey}:*`
        : `billing:usage:${tenantId}:*`
    : 'billing:usage:*';

  const keys: string[] = [];
  let cursor = '0';

  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  return keys;
}

/**
 * Parses a usage Redis key into its components.
 * Key format: billing:usage:{tenantId}:{customerId}:{subscriptionId|none}:{metricKey}:{windowKey}
 */
export function parseUsageKey(key: string): {
  tenantId: string;
  customerId: string;
  subscriptionId: string | null;
  metricKey: string;
  windowKey: string;
} | null {
  const parts = key.split(':');
  if (parts.length < 7 || parts[0] !== 'billing' || parts[1] !== 'usage') {
    return null;
  }

  return {
    tenantId: parts[2],
    customerId: parts[3],
    subscriptionId: parts[4] === 'none' ? null : parts[4],
    metricKey: parts[5],
    windowKey: parts.slice(6).join(':'),
  };
}
