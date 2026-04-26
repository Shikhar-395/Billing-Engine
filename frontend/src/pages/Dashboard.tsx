import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  BarChart3,
  FileText,
  TrendingUp,
  Users,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { tenantApi, planApi, subscriptionApi, invoiceApi, customerApi } from '../lib/api';
import { getTenantId } from '../lib/api';
import { formatCurrency, formatDate, relativeTime } from '../lib/utils';
import type { Subscription, Plan } from '../types';
import { useAuthSession } from '../lib/auth';

export default function DashboardPage() {
  const tenantId = getTenantId();
  const { data: session } = useAuthSession();
  const activeMembership = session?.memberships.find(m => m.tenantId === tenantId) ?? session?.memberships[0];

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantApi.get(tenantId!),
    enabled: !!tenantId,
  });

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => planApi.list(),
  });

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
    enabled: !!tenantId,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices', { status: '', offset: 0 }],
    queryFn: () => invoiceApi.list({ limit: 5 }),
    enabled: !!tenantId,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', {}],
    queryFn: () => customerApi.list({ status: 'ACTIVE' }),
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
  const customerCount = customers?.length || 0;

  const isEmpty = activePlanCount === 0 && customerCount === 0;

  return (
    <div>
      <div className="page-header">
        <h2>{activeMembership?.tenant.name ?? 'Dashboard'}</h2>
        <p>
          {activeMembership
            ? `${activeMembership.tenant.slug} · ${activeMembership.role}`
            : 'Billing workspace overview'}
        </p>
      </div>

      {/* Empty state onboarding */}
      {isEmpty && (
        <div className="card" style={{ marginBottom: 28, borderColor: 'rgba(43, 228, 167, 0.3)', background: 'linear-gradient(135deg, rgba(43,228,167,0.05), rgba(244,207,88,0.03))' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <span className="eyebrow">Getting started</span>
              <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Set up your billing workspace</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                Create plans, add customers, and start billing in minutes.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to="/plans" className="btn btn-primary btn-sm"><ArrowRight size={14} /> Create a Plan</Link>
                <Link to="/customers" className="btn btn-secondary btn-sm">Add a Customer</Link>
                <Link to="/dev-mailbox" className="btn btn-secondary btn-sm">Generate Sample Data</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon accent"><TrendingUp size={24} /></div>
          <div className="stat-info">
            <h3>{formattedMrr}</h3>
            <p>Monthly Recurring Revenue</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Users size={24} /></div>
          <div className="stat-info">
            <h3>{customerCount}</h3>
            <p>Active Customers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon accent"><CreditCard size={24} /></div>
          <div className="stat-info">
            <h3>{activeSubs.length}</h3>
            <p>Active Subscriptions</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><FileText size={24} /></div>
          <div className="stat-info">
            <h3>{totalInvoices}</h3>
            <p>Total Invoices</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><BarChart3 size={24} /></div>
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
          {activeSubs.length > 0 && (
            <Link to="/subscriptions" className="btn btn-ghost btn-sm">View all →</Link>
          )}
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Period</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions?.slice(0, 5).map((sub: Subscription) => (
                <tr key={sub.id}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>
                    {sub.customer?.name ?? '—'}
                  </td>
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
                  <td colSpan={5}>
                    <div className="empty-state" style={{ padding: '24px' }}>
                      <CreditCard size={32} />
                      <p>No subscriptions yet · <Link to="/subscriptions">Create one</Link></p>
                    </div>
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
          {totalInvoices > 0 && (
            <Link to="/invoices" className="btn btn-ghost btn-sm">View all →</Link>
          )}
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {invoicesData?.data?.slice(0, 5).map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                    {inv.invoiceNumber}
                  </td>
                  <td style={{ fontSize: 13 }}>{inv.customer?.name ?? '—'}</td>
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
                  <td colSpan={5}>
                    <div className="empty-state" style={{ padding: '24px' }}>
                      <FileText size={32} />
                      <p>No invoices yet</p>
                    </div>
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
