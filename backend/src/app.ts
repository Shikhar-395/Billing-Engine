import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// Route imports
import tenantRoutes from './routes/tenants.js';
import planRoutes from './routes/plans.js';
import subscriptionRoutes from './routes/subscriptions.js';
import usageRoutes from './routes/usage.js';
import invoiceRoutes from './routes/invoices.js';
import paymentRoutes from './routes/payments.js';
import webhookRoutes from './routes/webhooks.js';
import stripeWebhookRoute from './routes/stripeWebhook.js';
import auditLogRoutes from './routes/auditLogs.js';

/**
 * Express application factory.
 */
export function createApp(): express.Application {
  const app = express();

  // ── Global Middleware ────────────────────────────────────
  app.use(helmet());
  app.use(cors());
  app.use(morgan('short'));

  // Stripe webhook needs raw body — must be mounted BEFORE express.json()
  app.use(
    '/api/v1/stripe/webhook',
    express.raw({ type: 'application/json' }),
    (req, _res, next) => {
      req.rawBody = req.body;
      next();
    }
  );

  // Better Auth routes need the raw request before express.json()
  app.all('/api/auth/*', toNodeHandler(auth));

  // JSON body parser for all other routes
  app.use(express.json());

  // ── API Routes ───────────────────────────────────────────
  const v1 = express.Router();

  // Public routes (no auth)
  v1.use('/tenants', tenantRoutes);

  // Stripe webhook (separate auth via signature)
  v1.use('/stripe/webhook', stripeWebhookRoute);

  // Protected routes (JWT auth + rate limiting)
  v1.use('/plans', authenticate, rateLimiter, planRoutes);
  v1.use('/subscriptions', authenticate, rateLimiter, subscriptionRoutes);
  v1.use('/usage', authenticate, rateLimiter, usageRoutes);
  v1.use('/invoices', authenticate, rateLimiter, invoiceRoutes);
  v1.use('/payments', authenticate, rateLimiter, paymentRoutes);
  v1.use('/webhooks', authenticate, rateLimiter, webhookRoutes);
  v1.use('/audit-logs', authenticate, rateLimiter, auditLogRoutes);

  app.use('/api/v1', v1);

  // ── Health Check ─────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Error Handler ────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
