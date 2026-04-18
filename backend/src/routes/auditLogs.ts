import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { getPrisma } from '../config/prisma';

const router = Router();

// ── GET /audit-logs ──────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const {
      entityType,
      entityId,
      action,
      limit = '50',
      offset = '0',
    } = req.query;

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: req.tenant!.tenantId,
        ...(entityType ? { entityType: entityType as string } : {}),
        ...(entityId ? { entityId: entityId as string } : {}),
        ...(action ? { action: { contains: action as string } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    });

    const total = await prisma.auditLog.count({
      where: {
        tenantId: req.tenant!.tenantId,
        ...(entityType ? { entityType: entityType as string } : {}),
        ...(entityId ? { entityId: entityId as string } : {}),
        ...(action ? { action: { contains: action as string } } : {}),
      },
    });

    res.json({
      success: true,
      data: auditLogs,
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

export default router;
