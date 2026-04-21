import { Router, Request, Response, NextFunction } from 'express';
import { getPrisma } from '../config/prisma.js';
import { voidInvoice } from '../services/invoice/manager.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();

// ── GET /invoices ────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const { status, limit = '20', offset = '0' } = req.query;

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: req.tenant!.tenantId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        lineItems: true,
        subscription: { select: { plan: { select: { name: true } } } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    });

    const total = await prisma.invoice.count({
      where: {
        tenantId: req.tenant!.tenantId,
        ...(status ? { status: status as any } : {}),
      },
    });

    res.json({
      success: true,
      data: invoices,
      meta: {
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /invoices/:id ────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.tenant!.tenantId,
      },
      include: {
        lineItems: true,
        payments: { orderBy: { createdAt: 'desc' } },
        subscription: { include: { plan: true } },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice', req.params.id as string);
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

// ── POST /invoices/:id/void ──────────────────────────────
router.post('/:id/void', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.tenant!.tenantId,
      },
      select: { id: true },
    });

    if (!existingInvoice) throw new NotFoundError('Invoice', req.params.id as string);

    const voidedInvoice = await voidInvoice(req.params.id as string);
    res.json({ success: true, data: voidedInvoice });
  } catch (err) {
    next(err);
  }
});

export default router;
