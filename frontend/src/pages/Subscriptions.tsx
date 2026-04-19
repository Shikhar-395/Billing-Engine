import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, XCircle } from 'lucide-react';
import { subscriptionApi } from '../lib/api';
import { formatCurrency, formatDate, relativeTime } from '../lib/utils';
import type { Subscription } from '../types';

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: subscriptionApi.list,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading subscriptions...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Subscriptions</h2>
        <p>Manage active and past subscriptions</p>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Price</th>
                <th>Current Period</th>
                <th>Trial Ends</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions?.map((sub: Subscription) => (
                <tr key={sub.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CreditCard size={16} style={{ color: 'var(--accent-primary)' }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{sub.plan?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {sub.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${sub.status.toLowerCase()}`}>
                      <span className="badge-dot" />
                      {sub.status}
                    </span>
                  </td>
                  <td className="money">
                    {sub.plan ? formatCurrency(sub.plan.priceMonthly, sub.plan.currency) : '—'}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>/mo</span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {formatDate(sub.currentPeriodStart)} — {formatDate(sub.currentPeriodEnd)}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {sub.trialEndsAt ? formatDate(sub.trialEndsAt) : '—'}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {relativeTime(sub.createdAt)}
                  </td>
                  <td>
                    {(sub.status === 'ACTIVE' || sub.status === 'TRIALING') && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => cancelMutation.mutate(sub.id)}
                        disabled={cancelMutation.isPending}
                      >
                        <XCircle size={14} />
                        Cancel
                      </button>
                    )}
                    {sub.status === 'CANCELLED' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {sub.cancelledAt ? formatDate(sub.cancelledAt) : 'Cancelled'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(!subscriptions || subscriptions.length === 0) && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    <CreditCard size={40} />
                    <h3>No Subscriptions</h3>
                    <p>Create your first subscription to get started</p>
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
