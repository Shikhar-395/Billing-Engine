import { Request } from 'express';

// ── Express Augmentation ─────────────────────────────────
export interface TenantContext {
  userId: string;
  email: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

export interface AuthSessionContext {
  session: {
    id: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    emailVerified: boolean;
  };
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthSessionContext;
      tenant?: TenantContext;
      rawBody?: Buffer;
    }
  }
}

// ── API Response Types ───────────────────────────────────
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// ── BullMQ Job Data Interfaces ───────────────────────────
export interface UsageFlushJobData {
  triggeredAt: string;
}

export interface DunningJobData {
  subscriptionId: string;
  attemptNumber: number;
  dunningAttemptId: string;
}

export interface WebhookDeliveryJobData {
  deliveryId: string;
  endpointId: string;
  endpointUrl: string;
  signingSecret: string;
  eventType: string;
  payload: Record<string, any>;
}

export interface InvoiceGenerationJobData {
  subscriptionId: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
}

// ── Webhook Event Types ──────────────────────────────────
export type WebhookEventType =
  | 'subscription.created'
  | 'subscription.upgraded'
  | 'subscription.cancelled'
  | 'subscription.renewed'
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.voided'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'dunning.started'
  | 'dunning.exhausted'
  | 'usage.threshold_reached';
