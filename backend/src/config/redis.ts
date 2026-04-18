import Redis from 'ioredis';
import { env } from './env';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected');
    });
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
