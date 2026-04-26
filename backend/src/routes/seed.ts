import { Router, Request, Response, NextFunction } from 'express';
import { getPrisma } from '../config/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';

const router = Router();

// ── POST /dev/seed ────────────────────────────────────────
// Generates realistic sample data for the caller's active tenant.
// Only available outside production.
router.post(
  '/seed',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    if (env.NODE_ENV === 'production') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
      return;
    }

    try {
      const prisma = getPrisma();
      const tenantId = req.tenant!.tenantId;

      // Check if already seeded
      const existingCustomers = await prisma.customer.count({ where: { tenantId } });
      if (existingCustomers >= 3) {
        res.json({ success: true, data: { message: 'Workspace already has data — skipping seed.' } });
        return;
      }

      const now = new Date();

      // 1. Create plans (if none exist)
      let plans = await prisma.plan.findMany({ where: { tenantId }, take: 3 });
      if (plans.length === 0) {
        plans = await Promise.all([
          prisma.plan.create({
            data: {
              tenantId,
              name: 'Starter',
              slug: `starter-${tenantId.slice(0, 6)}`,
              priceMonthly: 49900,
              priceYearly: 479000,
              currency: 'INR',
              interval: 'MONTHLY',
              features: {
                create: [
                  { featureKey: 'api_calls', limitValue: 10000, limitType: 'HARD' },
                  { featureKey: 'seats', limitValue: 3, limitType: 'HARD' },
                  { featureKey: 'storage_gb', limitValue: 10, limitType: 'SOFT' },
                ],
              },
            },
          }),
          prisma.plan.create({
            data: {
              tenantId,
              name: 'Growth',
              slug: `growth-${tenantId.slice(0, 6)}`,
              priceMonthly: 149900,
              priceYearly: 1439000,
              currency: 'INR',
              interval: 'MONTHLY',
              features: {
                create: [
                  { featureKey: 'api_calls', limitValue: 100000, limitType: 'HARD' },
                  { featureKey: 'seats', limitValue: 15, limitType: 'HARD' },
                  { featureKey: 'storage_gb', limitValue: 100, limitType: 'SOFT' },
                  { featureKey: 'webhooks', limitValue: 10, limitType: 'HARD' },
                ],
              },
            },
          }),
          prisma.plan.create({
            data: {
              tenantId,
              name: 'Enterprise',
              slug: `enterprise-${tenantId.slice(0, 6)}`,
              priceMonthly: 499900,
              priceYearly: 4799000,
              currency: 'INR',
              interval: 'MONTHLY',
              features: {
                create: [
                  { featureKey: 'api_calls', limitValue: -1, limitType: 'SOFT' },
                  { featureKey: 'seats', limitValue: -1, limitType: 'SOFT' },
                  { featureKey: 'storage_gb', limitValue: -1, limitType: 'SOFT' },
                  { featureKey: 'webhooks', limitValue: -1, limitType: 'SOFT' },
                  { featureKey: 'sla', limitValue: 1, limitType: 'HARD' },
                ],
              },
            },
          }),
        ]);
      }

      // 2. Create customers
      const customers = await Promise.all([
        prisma.customer.create({
          data: {
            tenantId,
            name: 'Acme Corporation',
            email: `acme-${tenantId.slice(0, 6)}@example.com`,
            company: 'Acme Corp',
            status: 'ACTIVE',
          },
        }),
        prisma.customer.create({
          data: {
            tenantId,
            name: 'Globex Solutions',
            email: `globex-${tenantId.slice(0, 6)}@example.com`,
            company: 'Globex Solutions Pvt Ltd',
            status: 'ACTIVE',
          },
        }),
        prisma.customer.create({
          data: {
            tenantId,
            name: 'Initech Systems',
            email: `initech-${tenantId.slice(0, 6)}@example.com`,
            company: 'Initech',
            status: 'ACTIVE',
          },
        }),
      ]);

      // 3. Fetch tenant for invoice sequencing
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      let seq = tenant.nextInvoiceSequence;

      function nextInvoiceNumber() {
        const n = `INV-${String(seq).padStart(4, '0')}`;
        seq++;
        return n;
      }

      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // 4. Create subscriptions + invoices
      const subs = await Promise.all(
        customers.map((customer, i) => {
          const plan = plans[i % plans.length];
          return prisma.subscription.create({
            data: {
              tenantId,
              customerId: customer.id,
              planId: plan.id,
              status: i === 2 ? 'TRIALING' : 'ACTIVE',
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              trialEndsAt: i === 2 ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
            },
          });
        })
      );

      // 5. Create invoices with sequenced numbers
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < customers.length; i++) {
          const customer = customers[i];
          const sub = subs[i];
          const plan = plans[i % plans.length];
          const invoiceNum = nextInvoiceNumber();

          const invoice = await tx.invoice.create({
            data: {
              tenantId,
              customerId: customer.id,
              subscriptionId: sub.id,
              invoiceNumber: invoiceNum,
              status: i === 0 ? 'PAID' : i === 1 ? 'OPEN' : 'DRAFT',
              subtotal: plan.priceMonthly,
              tax: Math.round(plan.priceMonthly * 0.18),
              total: Math.round(plan.priceMonthly * 1.18),
              currency: plan.currency,
              dueAt: i === 1 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
              paidAt: i === 0 ? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) : null,
              lineItems: {
                create: [
                  {
                    description: `${plan.name} — Monthly subscription`,
                    quantity: 1,
                    unitPrice: plan.priceMonthly,
                    amount: plan.priceMonthly,
                    type: 'SUBSCRIPTION',
                  },
                  {
                    description: 'GST (18%)',
                    quantity: 1,
                    unitPrice: Math.round(plan.priceMonthly * 0.18),
                    amount: Math.round(plan.priceMonthly * 0.18),
                    type: 'TAX',
                  },
                ],
              },
            },
          });

          // Payment for paid invoice
          if (i === 0) {
            await tx.payment.create({
              data: {
                customerId: customer.id,
                invoiceId: invoice.id,
                status: 'SUCCEEDED',
                amount: invoice.total,
                currency: invoice.currency,
                processedAt: invoice.paidAt,
              },
            });
          }
        }

        // Update invoice sequence
        await tx.tenant.update({
          where: { id: tenantId },
          data: { nextInvoiceSequence: seq },
        });
      });

      // 6. Usage records
      await Promise.all(
        customers.flatMap((customer, i) => [
          prisma.usageRecord.create({
            data: {
              tenantId,
              customerId: customer.id,
              subscriptionId: subs[i].id,
              metricKey: 'api_calls',
              quantity: (i + 1) * 2340,
              windowStart: periodStart,
              windowEnd: now,
            },
          }),
          prisma.usageRecord.create({
            data: {
              tenantId,
              customerId: customer.id,
              subscriptionId: subs[i].id,
              metricKey: 'storage_gb',
              quantity: (i + 1) * 3,
              windowStart: periodStart,
              windowEnd: now,
            },
          }),
        ])
      );

      // 7. Webhook endpoint + deliveries
      const endpoint = await prisma.webhookEndpoint.create({
        data: {
          tenantId,
          url: 'https://hooks.example.com/billflow',
          signingSecret: 'wh_seed_secret_demo',
          eventTypes: ['subscription.created', 'invoice.paid', 'payment.succeeded'],
          isActive: true,
        },
      });

      await Promise.all([
        prisma.webhookDelivery.create({
          data: {
            endpointId: endpoint.id,
            eventType: 'subscription.created',
            payload: { event: 'subscription.created', customerId: customers[0].id },
            httpStatus: 200,
            attemptCount: 1,
            lastAttemptAt: new Date(Date.now() - 60 * 60 * 1000),
          },
        }),
        prisma.webhookDelivery.create({
          data: {
            endpointId: endpoint.id,
            eventType: 'invoice.paid',
            payload: { event: 'invoice.paid', customerId: customers[0].id },
            httpStatus: 500,
            attemptCount: 3,
            lastAttemptAt: new Date(Date.now() - 30 * 60 * 1000),
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          message: 'Workspace seeded successfully.',
          created: {
            plans: plans.length,
            customers: customers.length,
            subscriptions: subs.length,
            invoices: customers.length,
            webhookEndpoints: 1,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
