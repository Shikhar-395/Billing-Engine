import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { getPrisma } from '../config/prisma';
import { NotFoundError } from '../utils/errors';

const router = Router();

// ── GET /payments ────────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const { status, limit = '20', offset = '0' } = req.query;

    const payments = await prisma.payment.findMany({
      where: {
        invoice: { tenantId: req.tenant!.tenantId },
        ...(status ? { status: status as any } : {}),
      },
      include: {
        invoice: {
          select: {
            id: true,
            total: true,
            currency: true,
            subscription: { select: { plan: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    });

    res.json({
      success: true,
      data: payments,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /payments/:id ────────────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id as string },
      include: {
        invoice: {
          include: {
            lineItems: true,
            subscription: { include: { plan: true } },
          },
        },
      },
    });

    if (!payment) throw new NotFoundError('Payment', req.params.id as string);
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

export default router;
