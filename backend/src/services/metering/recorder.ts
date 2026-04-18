import { getRedis } from '../../config/redis';
import { windowKey } from '../../utils/dates';

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
  metricKey: string,
  quantity: number = 1
): Promise<number> {
  const redis = getRedis();
  const wk = windowKey();
  const key = `billing:usage:${tenantId}:${metricKey}:${wk}`;

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
  metricKey: string
): Promise<number> {
  const redis = getRedis();
  const wk = windowKey();
  const key = `billing:usage:${tenantId}:${metricKey}:${wk}`;
  const value = await redis.get(key);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Gets all active usage keys matching a tenant and optional metric.
 * Used by the flusher and usage summary endpoints.
 */
export async function getUsageKeys(
  tenantId?: string,
  metricKey?: string
): Promise<string[]> {
  const redis = getRedis();
  const pattern = tenantId
    ? metricKey
      ? `billing:usage:${tenantId}:${metricKey}:*`
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
 * Key format: billing:usage:{tenantId}:{metricKey}:{windowKey}
 */
export function parseUsageKey(key: string): {
  tenantId: string;
  metricKey: string;
  windowKey: string;
} | null {
  const parts = key.split(':');
  // billing:usage:tenantId:metricKey:windowKey
  if (parts.length < 5 || parts[0] !== 'billing' || parts[1] !== 'usage') {
    return null;
  }

  return {
    tenantId: parts[2],
    metricKey: parts[3],
    windowKey: parts.slice(4).join(':'),
  };
}
