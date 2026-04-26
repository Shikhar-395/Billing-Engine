import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getPrisma } from '../config/prisma.js';
import { requireRole } from '../middleware/auth.js';
import {
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
} from '../services/subscription/manager.js';
import { addProrationToInvoice } from '../services/invoice/generator.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();

// ── Schemas ──────────────────────────────────────────────
const createSubscriptionSchema = z.object({
  customerId: z.string().uuid(),
  planId: z.string().uuid(),
  trialDays: z.number().int().min(0).max(90).optional(),
});

const upgradeSubscriptionSchema = z.object({
  newPlanId: z.string().uuid(),
});

// ── POST /subscriptions ──────────────────────────────────
router.post(
  '/',
  requireRole('owner', 'admin', 'member'),
  validate(createSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subscription = await createSubscription({
      tenantId: req.tenant!.tenantId,
      customerId: req.body.customerId,
      planId: req.body.planId,
      trialDays: req.body.trialDays,
    });

    res.status(201).json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
});

// ── GET /subscriptions ───────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const customerId =
      typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    const subscriptions = await prisma.subscription.findMany({
      where: {
        tenantId: req.tenant!.tenantId,
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: true,
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.tenant!.tenantId,
      },
      include: {
        customer: true,
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
router.post(
  '/:id/upgrade',
  requireRole('owner', 'admin', 'member'),
  validate(upgradeSubscriptionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.tenant!.tenantId,
      },
      select: { id: true },
    });

    if (!currentSubscription) throw new NotFoundError('Subscription', req.params.id as string);

    const targetPlan = await prisma.plan.findFirst({
      where: {
        id: req.body.newPlanId,
        tenantId: req.tenant!.tenantId,
      },
      select: { id: true },
    });

    if (!targetPlan) throw new NotFoundError('Plan', req.body.newPlanId);

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
router.post(
  '/:id/cancel',
  requireRole('owner', 'admin', 'member'),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.tenant!.tenantId,
      },
      select: { id: true },
    });

    if (!currentSubscription) throw new NotFoundError('Subscription', req.params.id as string);

    const cancelledSubscription = await cancelSubscription(req.params.id as string);
    res.json({ success: true, data: cancelledSubscription });
  } catch (err) {
    next(err);
  }
});

export default router;
