export interface Tenant {
  id: string;
  name: string;
  slug: string;
  stripeCustomerId: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  plans?: Plan[];
  subscriptions?: Subscription[];
  _count?: { invoices: number; auditLogs: number };
}

export interface Plan {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  interval: 'MONTHLY' | 'YEARLY';
  isActive: boolean;
  metadata: any;
  createdAt: string;
  features?: PlanFeature[];
}

export interface PlanFeature {
  id: string;
  planId: string;
  featureKey: string;
  limitValue: number;
  limitType: 'HARD' | 'SOFT';
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  stripeSubId: string | null;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: Plan;
  invoices?: Invoice[];
  dunningAttempts?: DunningAttempt[];
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  stripeInvoiceId: string | null;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItems?: InvoiceLineItem[];
  payments?: Payment[];
  subscription?: { plan: { name: string } };
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: 'SUBSCRIPTION' | 'USAGE' | 'PRORATION' | 'TAX' | 'DISCOUNT';
}

export interface Payment {
  id: string;
  invoiceId: string;
  stripePaymentIntentId: string | null;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  amount: number;
  currency: string;
  processedAt: string | null;
  createdAt: string;
  invoice?: Invoice;
}

export interface DunningAttempt {
  id: string;
  subscriptionId: string;
  attemptNumber: number;
  status: 'SCHEDULED' | 'ATTEMPTED' | 'SUCCEEDED' | 'FAILED' | 'EXHAUSTED';
  failureReason: string | null;
  scheduledAt: string;
  executedAt: string | null;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
  signingSecret?: string;
  _count?: { deliveries: number };
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: string;
  payload: any;
  httpStatus: number | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string;
  endpoint?: { url: string };
}

export interface AuditLog {
  id: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: any;
  after: any;
  createdAt: string;
}

export interface UsageMetric {
  metricKey: string;
  totalQuantity: number;
  persistedQuantity: number;
  currentWindowQuantity: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { total: number; limit: number; offset: number };
  error?: { code: string; message: string };
}
