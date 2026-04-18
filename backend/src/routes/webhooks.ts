import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getPrisma } from '../config/prisma';
import { generateSigningSecret } from '../utils/crypto';
import { NotFoundError } from '../utils/errors';

const router = Router();

// ── Schemas ──────────────────────────────────────────────
const createEndpointSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.string().min(1)).min(1),
});

const updateEndpointSchema = z.object({
  url: z.string().url().optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
});

// ── POST /webhooks/endpoints ─────────────────────────────
router.post('/endpoints', authenticate, validate(createEndpointSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const signingSecret = generateSigningSecret();

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        tenantId: req.tenant!.tenantId,
        url: req.body.url,
        signingSecret,
        eventTypes: req.body.eventTypes,
      },
    });

    // Return signing secret ONLY on creation — never again
    res.status(201).json({
      success: true,
      data: {
        ...endpoint,
        signingSecret, // Only returned once!
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /webhooks/endpoints ──────────────────────────────
router.get('/endpoints', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId: req.tenant!.tenantId },
      select: {
        id: true,
        url: true,
        eventTypes: true,
        isActive: true,
        createdAt: true,
        // signingSecret is NEVER returned in list
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: endpoints });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /webhooks/endpoints/:id ────────────────────────
router.patch('/endpoints/:id', authenticate, validate(updateEndpointSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: req.params.id as string },
      data: req.body,
      select: {
        id: true,
        url: true,
        eventTypes: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: endpoint });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /webhooks/endpoints/:id ───────────────────────
router.delete('/endpoints/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    await prisma.webhookEndpoint.delete({
      where: { id: req.params.id as string },
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// ── GET /webhooks/deliveries ─────────────────────────────
router.get('/deliveries', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const { endpointId, eventType, limit = '50', offset = '0' } = req.query;

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        endpoint: { tenantId: req.tenant!.tenantId },
        ...(endpointId ? { endpointId: endpointId as string } : {}),
        ...(eventType ? { eventType: eventType as string } : {}),
      },
      include: {
        endpoint: { select: { url: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    });

    res.json({ success: true, data: deliveries });
  } catch (err) {
    next(err);
  }
});

export default router;
