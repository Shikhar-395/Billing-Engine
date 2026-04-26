import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getPrisma } from '../config/prisma.js';
import { generateSigningSecret } from '../utils/crypto.js';
import { NotFoundError } from '../utils/errors.js';

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
router.post('/endpoints', validate(createEndpointSchema), async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/endpoints', async (req: Request, res: Response, next: NextFunction) => {
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
router.patch('/endpoints/:id', validate(updateEndpointSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const existingEndpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.tenant!.tenantId,
      },
      select: { id: true },
    });

    if (!existingEndpoint) throw new NotFoundError('Webhook endpoint', req.params.id as string);

    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: existingEndpoint.id },
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
router.delete('/endpoints/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const existingEndpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        id: req.params.id as string,
        tenantId: req.tenant!.tenantId,
      },
      select: { id: true },
    });

    if (!existingEndpoint) throw new NotFoundError('Webhook endpoint', req.params.id as string);

    await prisma.webhookEndpoint.delete({
      where: { id: existingEndpoint.id },
    });

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// ── GET /webhooks/deliveries ─────────────────────────────
router.get('/deliveries', async (req: Request, res: Response, next: NextFunction) => {
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

// ── POST /webhooks/deliveries/:id/replay ─────────────────
router.post('/deliveries/:id/replay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrisma();
    const delivery = await prisma.webhookDelivery.findFirst({
      where: {
        id: req.params.id as string,
        endpoint: { tenantId: req.tenant!.tenantId },
      },
      include: { endpoint: true },
    });

    if (!delivery) throw new NotFoundError('Webhook delivery', req.params.id as string);

    let httpStatus: number | null = null;
    const now = new Date();

    try {
      const signal = AbortSignal.timeout(10_000);
      const response = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delivery.payload),
        signal,
      });
      httpStatus = response.status;
    } catch {
      httpStatus = null;
    }

    const updated = await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        httpStatus,
        attemptCount: delivery.attemptCount + 1,
        lastAttemptAt: now,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
