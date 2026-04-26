import axios from 'axios';
import type {
  ApiResponse,
  Tenant,
  Plan,
  PlanCreateInput,
  Customer,
  CustomerDetail,
  Subscription,
  Invoice,
  Payment,
  WebhookEndpoint,
  WebhookDelivery,
  AuditLog,
  UsageMetric,
  TenantMember,
  TenantInvitation,
  DevEmail,
} from '../types';

interface SubscriptionUpgradeResult {
  subscription: Subscription;
  proration: {
    prorationAmount: number;
    description: string;
    daysUsed: number;
    daysRemaining: number;
  };
}

interface DeleteResult {
  deleted?: boolean;
  id?: string;
  membershipId?: string;
  removedSelf?: boolean;
}

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Tenant ID management ──────────────────────────────────
let currentTenantId: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem('billflow_tenant_id') : null;

export function setTenantId(id: string) {
  currentTenantId = id;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('billflow_tenant_id', id);
  }
}

export function getTenantId(): string | null {
  return currentTenantId;
}

export function clearTenantId() {
  currentTenantId = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('billflow_tenant_id');
  }
}

api.interceptors.request.use((config) => {
  if (currentTenantId) {
    config.headers['X-Tenant-Id'] = currentTenantId;
  }
  return config;
});

// ── Tenants ──────────────────────────────────────────────
export const tenantApi = {
  create: (data: { name: string; slug: string }) =>
    api.post<ApiResponse<Tenant>>('/tenants', data).then(r => r.data.data),
  get: (id: string) =>
    api.get<ApiResponse<Tenant>>(`/tenants/${id}`).then(r => r.data.data),
  update: (id: string, data: Partial<Tenant>) =>
    api.patch<ApiResponse<Tenant>>(`/tenants/${id}`, data).then(r => r.data.data),
};

// ── Plans ────────────────────────────────────────────────
export const planApi = {
  list: (params?: { showAll?: boolean }) =>
    api.get<ApiResponse<Plan[]>>('/plans', { params }).then(r => r.data.data),
  get: (id: string) =>
    api.get<ApiResponse<Plan>>(`/plans/${id}`).then(r => r.data.data),
  create: (data: PlanCreateInput) =>
    api.post<ApiResponse<Plan>>('/plans', data).then(r => r.data.data),
  update: (id: string, data: Partial<Plan>) =>
    api.patch<ApiResponse<Plan>>(`/plans/${id}`, data).then(r => r.data.data),
  archive: (id: string) =>
    api.delete<ApiResponse<Plan>>(`/plans/${id}`).then(r => r.data.data),
};

// ── Customers ────────────────────────────────────────────
export const customerApi = {
  list: (params?: { status?: string; search?: string }) =>
    api.get<ApiResponse<Customer[]>>('/customers', { params }).then(r => r.data.data),
  get: (id: string) =>
    api.get<ApiResponse<CustomerDetail>>(`/customers/${id}`).then(r => r.data.data),
  create: (data: { name: string; email: string; company?: string; metadata?: unknown }) =>
    api.post<ApiResponse<Customer>>('/customers', data).then(r => r.data.data),
  update: (id: string, data: { name?: string; email?: string; company?: string | null; metadata?: unknown; status?: 'ACTIVE' | 'ARCHIVED' }) =>
    api.patch<ApiResponse<Customer>>(`/customers/${id}`, data).then(r => r.data.data),
  archive: (id: string) =>
    api.delete<ApiResponse<Customer>>(`/customers/${id}`).then(r => r.data.data),
};

// ── Subscriptions ────────────────────────────────────────
export const subscriptionApi = {
  list: (params?: { customerId?: string }) =>
    api.get<ApiResponse<Subscription[]>>('/subscriptions', { params }).then(r => r.data.data),
  get: (id: string) =>
    api.get<ApiResponse<Subscription>>(`/subscriptions/${id}`).then(r => r.data.data),
  create: (data: { customerId: string; planId: string; trialDays?: number }) =>
    api.post<ApiResponse<Subscription>>('/subscriptions', data).then(r => r.data.data),
  upgrade: (id: string, newPlanId: string) =>
    api.post<ApiResponse<SubscriptionUpgradeResult>>(`/subscriptions/${id}/upgrade`, { newPlanId }).then(r => r.data.data),
  cancel: (id: string) =>
    api.post<ApiResponse<Subscription>>(`/subscriptions/${id}/cancel`).then(r => r.data.data),
};

// ── Usage ────────────────────────────────────────────────
export const usageApi = {
  record: (data: { customerId: string; subscriptionId?: string; metricKey: string; quantity: number }) =>
    api.post<ApiResponse<{ customerId: string; subscriptionId: string | null; metricKey: string; currentWindowCount: number }>>('/usage', data).then(r => r.data.data),
  summary: (params?: { customerId?: string }) =>
    api.get<ApiResponse<{ period: string; metrics: UsageMetric[] }>>('/usage', { params }).then(r => r.data.data),
};

// ── Invoices ─────────────────────────────────────────────
export const invoiceApi = {
  list: (params?: { status?: string; customerId?: string; limit?: number; offset?: number }) =>
    api.get<ApiResponse<Invoice[]>>('/invoices', { params }).then(r => ({ data: r.data.data, meta: r.data.meta })),
  get: (id: string) =>
    api.get<ApiResponse<Invoice>>(`/invoices/${id}`).then(r => r.data.data),
  void: (id: string) =>
    api.post<ApiResponse<Invoice>>(`/invoices/${id}/void`).then(r => r.data.data),
};

// ── Payments ─────────────────────────────────────────────
export const paymentApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<ApiResponse<Payment[]>>('/payments', { params }).then(r => r.data.data),
  get: (id: string) =>
    api.get<ApiResponse<Payment>>(`/payments/${id}`).then(r => r.data.data),
};

// ── Webhooks ─────────────────────────────────────────────
export const webhookApi = {
  createEndpoint: (data: { url: string; eventTypes: string[] }) =>
    api.post<ApiResponse<WebhookEndpoint>>('/webhooks/endpoints', data).then(r => r.data.data),
  listEndpoints: () =>
    api.get<ApiResponse<WebhookEndpoint[]>>('/webhooks/endpoints').then(r => r.data.data),
  updateEndpoint: (id: string, data: { url?: string; eventTypes?: string[]; isActive?: boolean }) =>
    api.patch<ApiResponse<WebhookEndpoint>>(`/webhooks/endpoints/${id}`, data).then(r => r.data.data),
  deleteEndpoint: (id: string) =>
    api.delete<ApiResponse<DeleteResult>>(`/webhooks/endpoints/${id}`).then(r => r.data.data),
  listDeliveries: (params?: { endpointId?: string; eventType?: string }) =>
    api.get<ApiResponse<WebhookDelivery[]>>('/webhooks/deliveries', { params }).then(r => r.data.data),
  replayDelivery: (id: string) =>
    api.post<ApiResponse<WebhookDelivery>>(`/webhooks/deliveries/${id}/replay`).then(r => r.data.data),
};

// ── Audit Logs ───────────────────────────────────────────
export const auditApi = {
  list: (params?: { entityType?: string; entityId?: string; action?: string; limit?: number; offset?: number }) =>
    api.get<ApiResponse<AuditLog[]>>('/audit-logs', { params }).then(r => ({ data: r.data.data, meta: r.data.meta })),
};

// ── Team ─────────────────────────────────────────────────
export const teamApi = {
  listMembers: () =>
    api.get<ApiResponse<TenantMember[]>>('/team/members').then(r => r.data.data),
  updateMemberRole: (membershipId: string, role: TenantMember['role']) =>
    api.patch<ApiResponse<TenantMember>>(`/team/members/${membershipId}`, { role }).then(r => r.data.data),
  removeMember: (membershipId: string) =>
    api.delete<ApiResponse<DeleteResult>>(`/team/members/${membershipId}`).then(r => r.data.data),
  listInvitations: () =>
    api.get<ApiResponse<TenantInvitation[]>>('/team/invitations').then(r => r.data.data),
  createInvitation: (data: { email: string; role: TenantInvitation['role'] }) =>
    api.post<ApiResponse<TenantInvitation>>('/team/invitations', data).then(r => r.data.data),
  cancelInvitation: (invitationId: string) =>
    api.post<ApiResponse<TenantInvitation>>('/team/invitations/cancel', { invitationId }).then(r => r.data.data),
  getInvitationByToken: (token: string) =>
    api.get<ApiResponse<TenantInvitation>>(`/team/invitations/by-token/${token}`).then(r => r.data.data),
  acceptInvitation: (token: string) =>
    api.post<ApiResponse<TenantInvitation>>('/team/invitations/accept', { token }).then(r => r.data.data),
};

// ── Dev Mailbox ──────────────────────────────────────────
export const devMailboxApi = {
  list: (params?: { limit?: number }) =>
    api.get<ApiResponse<DevEmail[]>>('/dev/mailbox', { params }).then(r => r.data.data),
};

// ── Dev / Seed ───────────────────────────────────────────
export const devApi = {
  seed: () =>
    api.post<ApiResponse<{ message: string; created: Record<string, number> }>>('/dev/seed').then(r => r.data.data),
};

export default api;
