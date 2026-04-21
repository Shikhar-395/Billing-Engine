import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getPrisma } from '../config/prisma.js';
import { recordUsage, getCurrentUsage } from '../services/metering/recorder.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────
const recordUsageSchema = z.object({
  metricKey: z.string().min(1).max(100),
  quantity: z.number().int().min(1).default(1),
});

// ── POST /usage ──────────────────────────────────────────
// Records a usage event to Redis (sub-millisecond, no DB write)
router.post('/', validate(recordUsageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newCount = await recordUsage(
      req.tenant!.tenantId,
      req.body.metricKey,
      req.body.quantity
    );

    res.json({
      success: true,
      data: {
        metricKey: req.body.metricKey,
        currentWindowCount: newCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /usage ───────────────────────────────────────────
// Returns usage summary for the tenant (from both Redis and DB)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const tenantId = req.tenant!.tenantId;

    // Get persisted usage records from DB (aggregated)
    const dbUsage = await prisma.usageRecord.groupBy({
      by: ['metricKey'],
      where: {
        tenantId,
        windowStart: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      _sum: { quantity: true },
    });

    // Get current window (un-flushed) usage from Redis
    const metricKeys = [...new Set(dbUsage.map((r) => r.metricKey))];
    const currentUsage: Record<string, number> = {};
    for (const key of metricKeys) {
      currentUsage[key] = await getCurrentUsage(tenantId, key);
    }

    res.json({
      success: true,
      data: {
        period: 'last_30_days',
        metrics: dbUsage.map((r) => ({
          metricKey: r.metricKey,
          totalQuantity: (r._sum.quantity || 0) + (currentUsage[r.metricKey] || 0),
          persistedQuantity: r._sum.quantity || 0,
          currentWindowQuantity: currentUsage[r.metricKey] || 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
