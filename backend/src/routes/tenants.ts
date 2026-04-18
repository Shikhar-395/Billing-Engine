import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPrisma } from '../config/prisma';
import { validate } from '../middleware/validate';
import { NotFoundError } from '../utils/errors';

const router = Router();

// ── Schemas ──────────────────────────────────────────────
const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
});

// ── POST /tenants ────────────────────────────────────────
router.post('/', validate(createTenantSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const tenant = await prisma.tenant.create({
      data: req.body,
    });

    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

// ── GET /tenants/:id ─────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id as string },
      include: {
        plans: { where: { isActive: true } },
        subscriptions: { where: { status: { in: ['ACTIVE', 'TRIALING'] } } },
        _count: { select: { invoices: true, auditLogs: true } },
      },
    });

    if (!tenant) throw new NotFoundError('Tenant', req.params.id as string);
    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /tenants/:id ───────────────────────────────────
router.patch('/:id', validate(updateTenantSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id as string },
      data: req.body,
    });

    res.json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

export default router;
