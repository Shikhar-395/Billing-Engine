export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  stripeCustomerId: string | null;
  nextInvoiceSequence: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  plans?: Plan[];
  subscriptions?: Subscription[];
  _count?: { invoices: number; auditLogs: number };
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  company: string | null;
  stripeCustomerId: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  metadata: JsonValue;
  createdAt: string;
  updatedAt: string;
  _count?: { subscriptions: number; invoices: number; payments: number };
}

export interface CustomerDetail extends Customer {
  subscriptions: Subscription[];
  invoices: Invoice[];
  payments: Payment[];
  usageMetrics: { metricKey: string; totalQuantity: number }[];
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
  metadata: JsonValue;
  createdAt: string;
  features?: PlanFeature[];
}

export interface PlanCreateInput {
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  currency?: string;
  interval?: Plan['interval'];
  isActive?: boolean;
  metadata?: JsonValue;
  features?: Array<Pick<PlanFeature, 'featureKey' | 'limitValue' | 'limitType'>>;
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
  customerId: string;
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
  customer?: Customer;
  invoices?: Invoice[];
  dunningAttempts?: DunningAttempt[];
}

export interface Invoice {
  id: string;
  tenantId: string;
  customerId: string;
  subscriptionId: string;
  invoiceNumber: string;
  stripeInvoiceId: string | null;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; email: string };
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
  customerId: string;
  invoiceId: string;
  stripePaymentIntentId: string | null;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  amount: number;
  currency: string;
  processedAt: string | null;
  createdAt: string;
  invoice?: { id: string; invoiceNumber: string; total: number; currency: string };
  customer?: { name: string; email: string };
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
  payload: JsonValue;
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
  before: JsonValue;
  after: JsonValue;
  createdAt: string;
}

export interface UsageMetric {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  subscriptionId: string | null;
  metricKey: string;
  totalQuantity: number;
  persistedQuantity: number;
  currentWindowQuantity: number;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    emailVerified: boolean;
    createdAt: string;
  };
}

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  token: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';
  invitedByUserId: string;
  acceptedByUserId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  inviter?: { id: string; name: string; email: string };
  acceptedBy?: { id: string; name: string; email: string } | null;
  tenant?: { id: string; name: string; slug: string };
}

export interface DevEmail {
  id: string;
  tenantId: string | null;
  userId: string | null;
  type: 'VERIFICATION' | 'PASSWORD_RESET' | 'INVITATION';
  recipient: string;
  subject: string;
  textBody: string;
  actionUrl: string | null;
  metadata: JsonValue;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { total: number; limit: number; offset: number };
  error?: { code: string; message: string };
}
