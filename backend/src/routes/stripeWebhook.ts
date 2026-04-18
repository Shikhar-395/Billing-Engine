import { Router, Request, Response, NextFunction } from 'express';
import { getStripe } from '../config/stripe';
import { env } from '../config/env';
import { handleStripeEvent } from '../services/stripe/webhookHandler';

const router = Router();

/**
 * POST /api/v1/stripe/webhook
 *
 * Receives Stripe webhook events.
 * - Uses raw body for signature verification
 * - Idempotent processing via Redis SET NX
 */
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];

    if (!sig || !req.rawBody) {
      res.status(400).json({ error: 'Missing stripe-signature header or raw body' });
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('⚠️  Stripe webhook signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      return;
    }

    try {
      const processed = await handleStripeEvent(event);
      res.json({
        received: true,
        processed,
        eventId: event.id,
        eventType: event.type,
      });
    } catch (err) {
      // Return 500 so Stripe retries the webhook
      next(err);
    }
  }
);

export default router;
