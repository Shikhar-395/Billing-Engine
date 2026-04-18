import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getPrisma } from '../config/prisma';
import {
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
} from '../services/subscription/manager';
import { addProrationToInvoice } from '../services/invoice/generator';
import { NotFoundError } from '../utils/errors';

const router = Router();

// ── Schemas ──────────────────────────────────────────────
const createSubscriptionSchema = z.object({
  planId: z.string().uuid(),
  trialDays: z.number().int().min(0).max(90).optional(),
});

const upgradeSubscriptionSchema = z.object({
  newPlanId: z.string().uuid(),
});

// ── POST /subscriptions ──────────────────────────────────
router.post('/', authenticate, validate(createSubscriptionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await createSubscription({
      tenantId: req.tenant!.tenantId,
      planId: req.body.planId,
      trialDays: req.body.trialDays,
    });

    res.status(201).json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
});

// ── GET /subscriptions ───────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const subscriptions = await prisma.subscription.findMany({
      where: { tenantId: req.tenant!.tenantId },
      include: {
        plan: { include: { features: true } },
        dunningAttempts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: subscriptions });
  } catch (err) {
    next(err);
  }
});

// ── GET /subscriptions/:id ───────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id as string },
      include: {
        plan: { include: { features: true } },
        invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
        dunningAttempts: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!subscription) throw new NotFoundError('Subscription', req.params.id as string);
    res.json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
});

// ── POST /subscriptions/:id/upgrade ──────────────────────
router.post('/:id/upgrade', authenticate, validate(upgradeSubscriptionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await upgradeSubscription(req.params.id as string, req.body.newPlanId);

    // Add proration line item to invoice
    if (result.proration.prorationAmount !== 0) {
      await addProrationToInvoice(
        req.tenant!.tenantId,
        req.params.id as string,
        result.prorationLineItem
      );
    }

    res.json({
      success: true,
      data: {
        subscription: result.subscription,
        proration: result.proration,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /subscriptions/:id/cancel ───────────────────────
router.post('/:id/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await cancelSubscription(req.params.id as string);
    res.json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
});

export default router;
