import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getPrisma } from '../config/prisma.js';
import { requireRole } from '../middleware/auth.js';
import {
  getUsageKeys,
  parseUsageKey,
  recordUsage,
} from '../services/metering/recorder.js';
import { getRedis } from '../config/redis.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────
const recordUsageSchema = z.object({
  customerId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  metricKey: z.string().min(1).max(100),
  quantity: z.number().int().min(1).default(1),
});

// ── POST /usage ──────────────────────────────────────────
// Records a usage event to Redis (sub-millisecond, no DB write)
router.post(
  '/',
  requireRole('owner', 'admin', 'member'),
  validate(recordUsageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const customer = await prisma.customer.findFirst({
      where: {
        id: req.body.customerId,
        tenantId: req.tenant!.tenantId,
        status: 'ACTIVE',
      },
      select: { id: true, name: true },
    });

    if (!customer) {
      throw new NotFoundError('Customer', req.body.customerId);
    }

    if (req.body.subscriptionId) {
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: req.body.subscriptionId,
          tenantId: req.tenant!.tenantId,
          customerId: req.body.customerId,
        },
        select: { id: true },
      });

      if (!subscription) {
        throw new NotFoundError('Subscription', req.body.subscriptionId);
      }
    }

    const newCount = await recordUsage(
      req.tenant!.tenantId,
      req.body.customerId,
      req.body.metricKey,
      req.body.quantity,
      req.body.subscriptionId
    );

    res.json({
      success: true,
      data: {
        customerId: req.body.customerId,
        subscriptionId: req.body.subscriptionId ?? null,
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
    const redis = getRedis();
    const tenantId = req.tenant!.tenantId;
    const customerId =
      typeof req.query.customerId === 'string' ? req.query.customerId : undefined;

    // Get persisted usage records from DB (aggregated)
    const dbUsage = await prisma.usageRecord.groupBy({
      by: ['customerId', 'subscriptionId', 'metricKey'],
      where: {
        tenantId,
        ...(customerId ? { customerId } : {}),
        windowStart: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      _sum: { quantity: true },
    });

    const customerIds = [
      ...new Set(dbUsage.map((record) => record.customerId)),
      ...(customerId ? [customerId] : []),
    ];
    const customers = customerIds.length
      ? await prisma.customer.findMany({
          where: {
            tenantId,
            id: { in: customerIds },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];

    const liveMetrics = new Map<
      string,
      {
        customerId: string;
        subscriptionId: string | null;
        metricKey: string;
        currentWindowQuantity: number;
      }
    >();

    const activeKeys = await getUsageKeys(tenantId, customerId);

    for (const key of activeKeys) {
      const parsed = parseUsageKey(key);
      if (!parsed) continue;

      const value = await redis.get(key);
      if (!value) continue;

      const mapKey = [
        parsed.customerId,
        parsed.subscriptionId ?? 'none',
        parsed.metricKey,
      ].join(':');

      liveMetrics.set(mapKey, {
        customerId: parsed.customerId,
        subscriptionId: parsed.subscriptionId,
        metricKey: parsed.metricKey,
        currentWindowQuantity: parseInt(value, 10) || 0,
      });
    }

    const summaryMap = new Map<
      string,
      {
        customerId: string;
        subscriptionId: string | null;
        metricKey: string;
        persistedQuantity: number;
        currentWindowQuantity: number;
      }
    >();

    for (const record of dbUsage) {
      const mapKey = [
        record.customerId,
        record.subscriptionId ?? 'none',
        record.metricKey,
      ].join(':');

      summaryMap.set(mapKey, {
        customerId: record.customerId,
        subscriptionId: record.subscriptionId,
        metricKey: record.metricKey,
        persistedQuantity: record._sum.quantity || 0,
        currentWindowQuantity: 0,
      });
    }

    for (const [mapKey, liveRecord] of liveMetrics.entries()) {
      const existing = summaryMap.get(mapKey);
      if (existing) {
        existing.currentWindowQuantity = liveRecord.currentWindowQuantity;
      } else {
        summaryMap.set(mapKey, {
          customerId: liveRecord.customerId,
          subscriptionId: liveRecord.subscriptionId,
          metricKey: liveRecord.metricKey,
          persistedQuantity: 0,
          currentWindowQuantity: liveRecord.currentWindowQuantity,
        });
      }
    }

    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

    res.json({
      success: true,
      data: {
        period: 'last_30_days',
        metrics: Array.from(summaryMap.values()).map((metric) => ({
          customerId: metric.customerId,
          customerName: customerMap.get(metric.customerId)?.name ?? 'Unknown customer',
          customerEmail: customerMap.get(metric.customerId)?.email ?? null,
          subscriptionId: metric.subscriptionId,
          metricKey: metric.metricKey,
          totalQuantity:
            metric.persistedQuantity + metric.currentWindowQuantity,
          persistedQuantity: metric.persistedQuantity,
          currentWindowQuantity: metric.currentWindowQuantity,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
