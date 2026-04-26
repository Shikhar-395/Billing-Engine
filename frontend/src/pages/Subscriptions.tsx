import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, XCircle, Plus, ArrowUp, X } from 'lucide-react';
import { subscriptionApi, customerApi, planApi } from '../lib/api';
import { formatCurrency, formatDate, relativeTime } from '../lib/utils';
import type { Subscription, Customer, Plan } from '../types';
import { useToast } from '../components/Toast';

// ── New Subscription Modal ────────────────────────────────
function NewSubscriptionModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [trialDays, setTrialDays] = useState('');
  const [error, setError] = useState('');

  const { data: customers = [] } = useQuery({ queryKey: ['customers', {}], queryFn: () => customerApi.list({ status: 'ACTIVE' }) });
  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: () => planApi.list() });

  const mutation = useMutation({
    mutationFn: () => subscriptionApi.create({
      customerId,
      planId,
      trialDays: trialDays ? parseInt(trialDays, 10) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Subscription created');
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to create subscription';
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Subscription</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="auth-form" onSubmit={e => { e.preventDefault(); setError(''); mutation.mutate(); }}>
          <div className="form-group">
            <label className="form-label" htmlFor="sub-customer">Customer *</label>
            <select id="sub-customer" className="form-input" value={customerId} required
              onChange={e => setCustomerId(e.target.value)}>
              <option value="">Select a customer...</option>
              {customers.map((c: Customer) => (
                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sub-plan">Plan *</label>
            <select id="sub-plan" className="form-input" value={planId} required
              onChange={e => setPlanId(e.target.value)}>
              <option value="">Select a plan...</option>
              {plans.map((p: Plan) => (
                <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.priceMonthly, p.currency)}/mo</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sub-trial">Trial Days (optional)</label>
            <input id="sub-trial" type="number" min="0" max="90" className="form-input"
              placeholder="0" value={trialDays}
              onChange={e => setTrialDays(e.target.value)} />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? <><div className="spinner" />Creating...</> : <><CreditCard size={15} />Create Subscription</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Upgrade Modal ─────────────────────────────────────────
function UpgradeModal({ subscription, onClose }: { subscription: Subscription; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [planId, setPlanId] = useState('');
  const [result, setResult] = useState<{ proration: { prorationAmount: number; description: string } } | null>(null);
  const [error, setError] = useState('');

  const { data: plans = [] } = useQuery({ queryKey: ['plans'], queryFn: () => planApi.list() });

  const upgradeMutation = useMutation({
    mutationFn: () => subscriptionApi.upgrade(subscription.id, planId),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success('Subscription upgraded');
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to upgrade';
      setError(msg);
      toast.error(msg);
    },
  });

  if (result) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Upgrade Complete</h2>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Subscription upgraded successfully.</p>
          {result.proration.prorationAmount !== 0 && (
            <div style={{ padding: '12px 16px', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
              <strong style={{ color: 'var(--info)' }}>Proration: </strong>
              {result.proration.description} ({formatCurrency(Math.abs(result.proration.prorationAmount))})
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: 20, width: '100%' }} onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Upgrade Plan</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
          Current plan: <strong>{subscription.plan?.name ?? subscription.planId}</strong>
        </p>
        <form className="auth-form" onSubmit={e => { e.preventDefault(); setError(''); upgradeMutation.mutate(); }}>
          <div className="form-group">
            <label className="form-label" htmlFor="upgrade-plan">New Plan *</label>
            <select id="upgrade-plan" className="form-input" value={planId} required
              onChange={e => setPlanId(e.target.value)}>
              <option value="">Select new plan...</option>
              {plans.filter((p: Plan) => p.id !== subscription.planId).map((p: Plan) => (
                <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.priceMonthly, p.currency)}/mo</option>
              ))}
            </select>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={upgradeMutation.isPending}>
              {upgradeMutation.isPending ? <><div className="spinner" />Upgrading...</> : <><ArrowUp size={15} />Upgrade</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [customerFilter, setCustomerFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<Subscription | null>(null);

  const { data: customers = [] } = useQuery({ queryKey: ['customers', {}], queryFn: () => customerApi.list({ status: 'ACTIVE' }) });

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['subscriptions', { customerId: customerFilter }],
    queryFn: () => subscriptionApi.list({ customerId: customerFilter || undefined }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); toast.success('Subscription cancelled'); },
    onError: () => toast.error('Failed to cancel subscription'),
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading subscriptions...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Subscriptions</h2>
          <p>Manage active and past subscriptions</p>
        </div>
        <button className="btn btn-primary" id="btn-new-subscription" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Subscription
        </button>
      </div>

      {/* Customer filter */}
      <div style={{ marginBottom: 20 }}>
        <select className="form-input" style={{ width: 'auto', minWidth: 240 }} value={customerFilter}
          onChange={e => setCustomerFilter(e.target.value)} id="sub-customer-filter">
          <option value="">All customers</option>
          {customers.map((c: Customer) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
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
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{sub.customer?.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub.customer?.email ?? ''}</div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CreditCard size={16} style={{ color: 'var(--accent-primary)' }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{sub.plan?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sub.id.slice(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${sub.status.toLowerCase()}`}><span className="badge-dot" />{sub.status}</span></td>
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
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{relativeTime(sub.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(sub.status === 'ACTIVE' || sub.status === 'TRIALING') && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => setUpgradeTarget(sub)} id={`upgrade-${sub.id}`}>
                            <ArrowUp size={13} /> Upgrade
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => cancelMutation.mutate(sub.id)} disabled={cancelMutation.isPending} id={`cancel-${sub.id}`}>
                            <XCircle size={13} /> Cancel
                          </button>
                        </>
                      )}
                      {sub.status === 'CANCELLED' && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {sub.cancelledAt ? formatDate(sub.cancelledAt) : 'Cancelled'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!subscriptions || subscriptions.length === 0) && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <CreditCard size={40} />
                      <h3>No Subscriptions</h3>
                      <p>Create your first subscription to get started</p>
                      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> New Subscription
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <NewSubscriptionModal onClose={() => setShowCreate(false)} />}
      {upgradeTarget && <UpgradeModal subscription={upgradeTarget} onClose={() => setUpgradeTarget(null)} />}
    </div>
  );
}
