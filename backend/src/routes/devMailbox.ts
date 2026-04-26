import { Router, Request, Response, NextFunction } from 'express';
import { authenticateSession } from '../middleware/auth.js';
import { getPrisma } from '../config/prisma.js';
import { listDevEmailsVisibleToUser } from '../services/email/mailer.js';

const router = Router();

router.get(
  '/mailbox',
  authenticateSession,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestedTenantId =
        typeof req.headers['x-tenant-id'] === 'string'
          ? req.headers['x-tenant-id']
          : undefined;

      let visibleTenantId: string | undefined;

      if (requestedTenantId) {
        const prisma = getPrisma();
        const membership = await prisma.tenantMembership.findFirst({
          where: {
            tenantId: requestedTenantId,
            userId: req.auth!.user.id,
          },
          select: { tenantId: true },
        });

        visibleTenantId = membership?.tenantId;
      }

      const limit = typeof req.query.limit === 'string'
        ? Math.min(Math.max(parseInt(req.query.limit, 10), 1), 200)
        : 100;

      const emails = await listDevEmailsVisibleToUser({
        userId: req.auth!.user.id,
        userEmail: req.auth!.user.email,
        tenantId: visibleTenantId,
        limit,
      });

      res.json({ success: true, data: emails });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
