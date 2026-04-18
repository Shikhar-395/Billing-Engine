import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../config/redis';
import { env } from '../config/env';
import { RateLimitError } from '../utils/errors';

/**
 * Redis sliding-window rate limiter.
 * Uses sorted sets with timestamps as scores for precise per-tenant limiting.
 *
 * Default: 100 requests per 60-second window.
 */
export function rateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.tenant?.tenantId || req.ip || 'anonymous';
  const key = `ratelimit:${tenantId}`;
  const maxRequests = env.RATE_LIMIT_MAX;
  const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
  const now = Date.now();
  const windowStart = now - windowMs;

  const redis = getRedis();

  redis
    .pipeline()
    .zremrangebyscore(key, 0, windowStart) // Remove expired entries
    .zadd(key, now, `${now}:${Math.random()}`) // Add current request
    .zcard(key) // Count requests in window
    .pexpire(key, windowMs) // Ensure key expiry
    .exec()
    .then((results) => {
      if (!results) return next();

      const requestCount = results[2]?.[1] as number;

      if (requestCount > maxRequests) {
        const retryAfter = Math.ceil(env.RATE_LIMIT_WINDOW_SECONDS);
        return next(new RateLimitError(retryAfter));
      }

      next();
    })
    .catch((err) => {
      // If Redis is down, allow the request through (fail open)
      console.error('Rate limiter error:', err.message);
      next();
    });
}
