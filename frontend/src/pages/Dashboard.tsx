import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  BarChart3,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { tenantApi, planApi, subscriptionApi, invoiceApi } from '../lib/api';
import { getTenantId } from '../lib/api';
import { formatCurrency, formatDate, relativeTime } from '../lib/utils';
import type { Subscription, Plan } from '../types';

export default function DashboardPage() {
  const tenantId = getTenantId();

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantApi.get(tenantId!),
    enabled: !!tenantId,
  });

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: planApi.list,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: subscriptionApi.list,
    enabled: !!tenantId,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.list({ limit: 5 }),
    enabled: !!tenantId,
  });

  const activeSubs = subscriptions?.filter(
    (s: Subscription) => s.status === 'ACTIVE' || s.status === 'TRIALING'
  ) || [];
  const mrr = activeSubs.reduce((sum: number, s: Subscription) => {
    const plan = plans?.find((p: Plan) => p.id === s.planId);
    return sum + (plan?.priceMonthly || 0);
  }, 0);
  const formattedMrr = formatCurrency(mrr);
  const totalInvoices = tenant?._count?.invoices || 0;
  const activePlanCount = plans?.length || 0;
  const billingSnapshot = [
    'billing:@(4):metric,value',
    `mrr,${formattedMrr}`,
    `subscriptions,${activeSubs.length}`,
    `invoices,${totalInvoices}`,
    `plans,${activePlanCount}`,
  ].join('\n');

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of {tenant?.name || 'your billing engine'}</p>
      </div>

      <div className="dashboard-snapshot">
        <div>
          <span className="eyebrow">Runtime snapshot</span>
          <h3>Billing state, compressed for quick decisions.</h3>
          <p>Live tenant context is encoded into the same compact shape the rest of the system runs on.</p>
        </div>
        <pre aria-label="Billing runtime snapshot">{billingSnapshot}</pre>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon accent">
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <h3>{formattedMrr}</h3>
            <p>Monthly Recurring Revenue</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CreditCard size={24} />
          </div>
          <div className="stat-info">
            <h3>{activeSubs.length}</h3>
            <p>Active Subscriptions</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon cyan">
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <h3>{totalInvoices}</h3>
            <p>Total Invoices</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon yellow">
            <BarChart3 size={24} />
          </div>
          <div className="stat-info">
            <h3>{activePlanCount}</h3>
            <p>Active Plans</p>
          </div>
        </div>
      </div>

      {/* Recent Subscriptions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Recent Subscriptions</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Period</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions?.slice(0, 5).map((sub: Subscription) => (
                <tr key={sub.id}>
                  <td style={{ fontWeight: 600 }}>
                    {sub.plan?.name || 'Unknown'}
                  </td>
                  <td>
                    <span className={`badge ${sub.status.toLowerCase()}`}>
                      <span className="badge-dot" />
                      {sub.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {formatDate(sub.currentPeriodStart)} — {formatDate(sub.currentPeriodEnd)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {relativeTime(sub.createdAt)}
                  </td>
                </tr>
              ))}
              {(!subscriptions || subscriptions.length === 0) && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    <p>No subscriptions yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Invoices</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {invoicesData?.data?.slice(0, 5).map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {inv.id.slice(0, 8)}
                  </td>
                  <td className="money">{formatCurrency(inv.total, inv.currency)}</td>
                  <td>
                    <span className={`badge ${inv.status.toLowerCase()}`}>
                      <span className="badge-dot" />
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {formatDate(inv.createdAt)}
                  </td>
                </tr>
              ))}
              {(!invoicesData?.data || invoicesData.data.length === 0) && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    <p>No invoices yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
