import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  authenticate,
  authenticateSession,
  requireRole,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  getInvitationByToken,
  listInvitations,
  listMembers,
  removeMember,
  updateMemberRole,
} from '../services/team/invitations.js';

const router = Router();

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

const cancelInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

router.get(
  '/members',
  authenticate,
  requireRole('owner', 'admin', 'member', 'viewer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await listMembers(req.tenant!.tenantId);
      res.json({ success: true, data: members });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/members/:id',
  authenticate,
  requireRole('owner', 'admin'),
  validate(updateMemberRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const membership = await updateMemberRole({
        tenantId: req.tenant!.tenantId,
        membershipId: req.params.id as string,
        role: req.body.role,
      });

      res.json({ success: true, data: membership });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/members/:id',
  authenticate,
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await removeMember({
        tenantId: req.tenant!.tenantId,
        membershipId: req.params.id as string,
        currentUserId: req.auth!.user.id,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/invitations',
  authenticate,
  requireRole('owner', 'admin'),
  validate(inviteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invitation = await createInvitation({
        tenantId: req.tenant!.tenantId,
        invitedByUserId: req.auth!.user.id,
        email: req.body.email,
        role: req.body.role,
      });

      res.status(201).json({ success: true, data: invitation });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/invitations',
  authenticate,
  requireRole('owner', 'admin', 'member', 'viewer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invitations = await listInvitations(req.tenant!.tenantId);
      res.json({ success: true, data: invitations });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/invitations/cancel',
  authenticate,
  requireRole('owner', 'admin'),
  validate(cancelInvitationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invitation = await cancelInvitation({
        tenantId: req.tenant!.tenantId,
        invitationId: req.body.invitationId,
      });

      res.json({ success: true, data: invitation });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/invitations/by-token/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invitation = await getInvitationByToken(req.params.token as string);
      res.json({ success: true, data: invitation });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/invitations/accept',
  authenticateSession,
  validate(acceptInvitationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invitation = await acceptInvitation({
        token: req.body.token,
        userId: req.auth!.user.id,
        userEmail: req.auth!.user.email,
      });

      res.json({ success: true, data: invitation });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
