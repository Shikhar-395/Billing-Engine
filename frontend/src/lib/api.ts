import axios from 'axios';
import type { ApiResponse, Tenant, Plan, Subscription, Invoice, Payment, WebhookEndpoint, WebhookDelivery, AuditLog, UsageMetric } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Inject tenant ID header on every request
let currentTenantId: string | null = null;
export function setTenantId(id: string) {
  currentTenantId = id;
}
export function getTenantId(): string | null {
  return currentTenantId;
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
  list: () =>
    api.get<ApiResponse<Plan[]>>('/plans').then(r => r.data.data),
  get: (id: string) =>
    api.get<ApiResponse<Plan>>(`/plans/${id}`).then(r => r.data.data),
  create: (data: any) =>
    api.post<ApiResponse<Plan>>('/plans', data).then(r => r.data.data),
  update: (id: string, data: Partial<Plan>) =>
    api.patch<ApiResponse<Plan>>(`/plans/${id}`, data).then(r => r.data.data),
  delete: (id: string) =>
    api.delete<ApiResponse<Plan>>(`/plans/${id}`).then(r => r.data.data),
};

// ── Subscriptions ────────────────────────────────────────
export const subscriptionApi = {
  list: () =>
    api.get<ApiResponse<Subscription[]>>('/subscriptions').then(r => r.data.data),
  get: (id: string) =>
    api.get<ApiResponse<Subscription>>(`/subscriptions/${id}`).then(r => r.data.data),
  create: (data: { planId: string; trialDays?: number }) =>
    api.post<ApiResponse<Subscription>>('/subscriptions', data).then(r => r.data.data),
  upgrade: (id: string, newPlanId: string) =>
    api.post<ApiResponse<any>>(`/subscriptions/${id}/upgrade`, { newPlanId }).then(r => r.data.data),
  cancel: (id: string) =>
    api.post<ApiResponse<Subscription>>(`/subscriptions/${id}/cancel`).then(r => r.data.data),
};

// ── Usage ────────────────────────────────────────────────
export const usageApi = {
  record: (data: { metricKey: string; quantity: number }) =>
    api.post<ApiResponse<{ metricKey: string; currentWindowCount: number }>>('/usage', data).then(r => r.data.data),
  summary: () =>
    api.get<ApiResponse<{ period: string; metrics: UsageMetric[] }>>('/usage').then(r => r.data.data),
};

// ── Invoices ─────────────────────────────────────────────
export const invoiceApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<ApiResponse<Invoice[]> & { meta: any }>('/invoices', { params }).then(r => ({ data: r.data.data, meta: r.data.meta })),
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
  updateEndpoint: (id: string, data: Partial<WebhookEndpoint>) =>
    api.patch<ApiResponse<WebhookEndpoint>>(`/webhooks/endpoints/${id}`, data).then(r => r.data.data),
  deleteEndpoint: (id: string) =>
    api.delete<ApiResponse<any>>(`/webhooks/endpoints/${id}`).then(r => r.data.data),
  listDeliveries: (params?: { endpointId?: string; eventType?: string }) =>
    api.get<ApiResponse<WebhookDelivery[]>>('/webhooks/deliveries', { params }).then(r => r.data.data),
};

// ── Audit Logs ───────────────────────────────────────────
export const auditApi = {
  list: (params?: { entityType?: string; entityId?: string; action?: string; limit?: number; offset?: number }) =>
    api.get<ApiResponse<AuditLog[]> & { meta: any }>('/audit-logs', { params }).then(r => ({ data: r.data.data, meta: r.data.meta })),
};

export default api;
