import { Redis } from 'ioredis';
import { env } from './env.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    client.on('error', (err: Error) => {
      console.error('Redis connection error:', err.message);
    });

    client.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redis = client;
  }

  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('🔌 Redis disconnected');
  }
}
