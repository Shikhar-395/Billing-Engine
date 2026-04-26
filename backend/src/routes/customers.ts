import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getPrisma } from '../config/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  company: z.string().max(255).optional(),
  metadata: z.any().optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  company: z.string().max(255).nullable().optional(),
  metadata: z.any().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

router.post(
  '/',
  requireRole('owner', 'admin', 'member'),
  validate(createCustomerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prisma = getPrisma();
      const customer = await prisma.customer.create({
        data: {
          tenantId: req.tenant!.tenantId,
          ...req.body,
          email: req.body.email.toLowerCase(),
        },
      });

      res.status(201).json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: req.tenant!.tenantId,
        ...(status ? { status: status as 'ACTIVE' | 'ARCHIVED' } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const customer = await prisma.customer.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.tenant!.tenantId,
      },
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        invoices: {
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        payments: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                total: true,
                currency: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer', req.params.id as string);
    }

    const usage = await prisma.usageRecord.groupBy({
      by: ['metricKey'],
      where: {
        tenantId: req.tenant!.tenantId,
        customerId: customer.id,
      },
      _sum: {
        quantity: true,
      },
    });

    res.json({
      success: true,
      data: {
        ...customer,
        usageMetrics: usage.map((metric) => ({
          metricKey: metric.metricKey,
          totalQuantity: metric._sum.quantity ?? 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id',
  requireRole('owner', 'admin', 'member'),
  validate(updateCustomerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prisma = getPrisma();
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          id: req.params.id as string,
          tenantId: req.tenant!.tenantId,
        },
        select: { id: true },
      });

      if (!existingCustomer) {
        throw new NotFoundError('Customer', req.params.id as string);
      }

      const customer = await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          ...req.body,
          ...(req.body.email
            ? { email: req.body.email.toLowerCase() }
            : undefined),
        },
      });

      res.json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prisma = getPrisma();
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          id: req.params.id as string,
          tenantId: req.tenant!.tenantId,
        },
        select: {
          id: true,
          _count: {
            select: {
              subscriptions: true,
            },
          },
        },
      });

      if (!existingCustomer) {
        throw new NotFoundError('Customer', req.params.id as string);
      }

      const customer = await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: { status: 'ARCHIVED' },
      });

      res.json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
