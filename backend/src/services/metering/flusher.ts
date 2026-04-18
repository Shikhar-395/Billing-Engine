import { getRedis } from '../../config/redis';
import { getPrisma } from '../../config/prisma';
import { getUsageKeys, parseUsageKey } from './recorder';
import { windowStart, windowEnd } from '../../utils/dates';

/**
 * Usage flusher.
 *
 * Runs periodically (every 60 seconds via BullMQ cron):
 * 1. SCAN for all billing:usage:* keys
 * 2. Read values
 * 3. Batch insert UsageRecord rows via prisma.usageRecord.createMany
 * 4. Delete keys atomically via a Lua script
 */

// Lua script for atomic key deletion
// Ensures no data is lost between read and delete
const FLUSH_LUA_SCRIPT = `
  local values = {}
  for i, key in ipairs(KEYS) do
    values[i] = redis.call('GET', key)
    redis.call('DEL', key)
  end
  return values
`;

export interface FlushedRecord {
  tenantId: string;
  metricKey: string;
  quantity: number;
  windowKey: string;
}

/**
 * Flushes all Redis usage counters to Postgres.
 * Returns the number of records flushed.
 */
export async function flushUsageToDatabase(): Promise<number> {
  const redis = getRedis();
  const prisma = getPrisma();

  // 1. Scan for all usage keys
  const keys = await getUsageKeys();

  if (keys.length === 0) {
    return 0;
  }

  // 2. Atomically read and delete all keys via Lua
  const values = (await redis.eval(FLUSH_LUA_SCRIPT, keys.length, ...keys)) as (
    | string
    | null
  )[];

  // 3. Parse keys and build records
  const records: FlushedRecord[] = [];
  for (let i = 0; i < keys.length; i++) {
    const value = values[i];
    if (!value) continue;

    const parsed = parseUsageKey(keys[i]);
    if (!parsed) continue;

    const quantity = parseInt(value, 10);
    if (isNaN(quantity) || quantity <= 0) continue;

    records.push({
      tenantId: parsed.tenantId,
      metricKey: parsed.metricKey,
      quantity,
      windowKey: parsed.windowKey,
    });
  }

  if (records.length === 0) {
    return 0;
  }

  // 4. Batch insert into Postgres
  const now = new Date();
  await prisma.usageRecord.createMany({
    data: records.map((r) => ({
      tenantId: r.tenantId,
      metricKey: r.metricKey,
      quantity: r.quantity,
      windowStart: windowStart(now),
      windowEnd: windowEnd(now),
    })),
  });

  console.log(`📊 Flushed ${records.length} usage records to database`);
  return records.length;
}
