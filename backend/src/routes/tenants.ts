import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPrisma } from '../config/prisma.js';
import { authenticate, authenticateSession } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../utils/errors.js';

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
router.post('/', authenticateSession, validate(createTenantSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: req.body,
      });

      await tx.tenantMembership.create({
        data: {
          tenantId: createdTenant.id,
          userId: req.auth!.user.id,
          role: 'OWNER',
        },
      });

      return createdTenant;
    });

    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    next(err);
  }
});

// ── GET /tenants/:id ─────────────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id !== req.tenant!.tenantId) {
      throw new NotFoundError('Tenant', req.params.id as string);
    }

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
router.patch('/:id', authenticate, validate(updateTenantSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id !== req.tenant!.tenantId) {
      throw new NotFoundError('Tenant', req.params.id as string);
    }

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
