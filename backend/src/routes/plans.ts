import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPrisma } from '../config/prisma';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { NotFoundError } from '../utils/errors';

const router = Router();

// ── Schemas ──────────────────────────────────────────────
const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  priceMonthly: z.number().int().min(0),
  priceYearly: z.number().int().min(0),
  currency: z.string().default('INR'),
  interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
  metadata: z.any().optional(),
  features: z
    .array(
      z.object({
        featureKey: z.string().min(1),
        limitValue: z.number().int(), // -1 = unlimited
        limitType: z.enum(['HARD', 'SOFT']).default('HARD'),
      })
    )
    .optional(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  priceMonthly: z.number().int().min(0).optional(),
  priceYearly: z.number().int().min(0).optional(),
  interval: z.enum(['MONTHLY', 'YEARLY']).optional(),
  isActive: z.boolean().optional(),
  metadata: z.any().optional(),
});

// ── POST /plans ──────────────────────────────────────────
router.post('/', authenticate, validate(createPlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const { features, ...planData } = req.body;

    const plan = await prisma.plan.create({
      data: {
        ...planData,
        tenantId: req.tenant!.tenantId,
        features: features
          ? { create: features }
          : undefined,
      },
      include: { features: true },
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// ── GET /plans ───────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      include: { features: true },
      orderBy: { priceMonthly: 'asc' },
    });

    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

// ── GET /plans/:id ───────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id as string },
      include: { features: true },
    });

    if (!plan) throw new NotFoundError('Plan', req.params.id as string);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /plans/:id ─────────────────────────────────────
router.patch('/:id', authenticate, validate(updatePlanSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const plan = await prisma.plan.update({
      where: { id: req.params.id as string },
      data: req.body,
      include: { features: true },
    });

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /plans/:id (soft delete) ──────────────────────
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const plan = await prisma.plan.update({
      where: { id: req.params.id as string },
      data: { isActive: false },
    });

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

export default router;
