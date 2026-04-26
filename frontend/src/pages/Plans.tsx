import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Check, Plus, Pencil, Archive, RotateCcw, X } from 'lucide-react';
import { planApi } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import type { Plan, PlanCreateInput } from '../types';
import { useToast } from '../components/Toast';

// ── Plan Form Modal ───────────────────────────────────────
function PlanModal({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({
    name: plan?.name ?? '',
    slug: plan?.slug ?? '',
    priceMonthly: plan ? String(plan.priceMonthly / 100) : '',
    priceYearly: plan ? String(plan.priceYearly / 100) : '',
    currency: plan?.currency ?? 'INR',
    interval: plan?.interval ?? 'MONTHLY' as 'MONTHLY' | 'YEARLY',
  });
  const [features, setFeatures] = useState<Array<{ featureKey: string; limitValue: string; limitType: 'HARD' | 'SOFT' }>>(
    plan?.features?.map(f => ({
      featureKey: f.featureKey,
      limitValue: String(f.limitValue),
      limitType: f.limitType,
    })) ?? []
  );
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: PlanCreateInput) => planApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Plan created');
      onClose();
    },
    onError: () => { setError('Failed to create plan'); toast.error('Failed to create plan'); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Plan>) => planApi.update(plan!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Plan updated');
      onClose();
    },
    onError: () => { setError('Failed to update plan'); toast.error('Failed to update plan'); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const monthly = Math.round(parseFloat(form.priceMonthly) * 100);
    const yearly = Math.round(parseFloat(form.priceYearly) * 100);
    if (isNaN(monthly) || isNaN(yearly)) { setError('Invalid price'); return; }

    const featuresParsed = features
      .filter(f => f.featureKey.trim())
      .map(f => ({
        featureKey: f.featureKey.trim(),
        limitValue: f.limitValue === '-1' || f.limitValue === '' ? -1 : parseInt(f.limitValue, 10),
        limitType: f.limitType,
      }));

    if (plan) {
      updateMutation.mutate({
        name: form.name,
        priceMonthly: monthly,
        priceYearly: yearly,
        interval: form.interval,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        slug: form.slug || autoSlug(form.name),
        priceMonthly: monthly,
        priceYearly: yearly,
        currency: form.currency,
        interval: form.interval,
        features: featuresParsed,
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{plan ? 'Edit Plan' : 'New Plan'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="plan-name">Plan Name *</label>
            <input id="plan-name" className="form-input" value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: plan ? f.slug : autoSlug(e.target.value) }))} />
          </div>
          {!plan && (
            <div className="form-group">
              <label className="form-label" htmlFor="plan-slug">Slug *</label>
              <input id="plan-slug" className="form-input" value={form.slug} required pattern="[a-z0-9-]+"
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="plan-monthly">Monthly Price *</label>
              <input id="plan-monthly" type="number" step="0.01" min="0" className="form-input" value={form.priceMonthly} required
                onChange={e => setForm(f => ({ ...f, priceMonthly: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="plan-yearly">Yearly Price *</label>
              <input id="plan-yearly" type="number" step="0.01" min="0" className="form-input" value={form.priceYearly} required
                onChange={e => setForm(f => ({ ...f, priceYearly: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="plan-interval">Default Interval</label>
            <select id="plan-interval" className="form-input" value={form.interval}
              onChange={e => setForm(f => ({ ...f, interval: e.target.value as 'MONTHLY' | 'YEARLY' }))}>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>

          {/* Features */}
          {!plan && (
            <div className="form-group">
              <label className="form-label">Features</label>
              <div style={{ display: 'grid', gap: 8 }}>
                {features.map((f, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 32px', gap: 6 }}>
                    <input className="form-input" placeholder="feature_key" value={f.featureKey}
                      onChange={e => setFeatures(prev => prev.map((x, xi) => xi === i ? { ...x, featureKey: e.target.value } : x))} />
                    <input className="form-input" placeholder="-1" type="number" value={f.limitValue}
                      onChange={e => setFeatures(prev => prev.map((x, xi) => xi === i ? { ...x, limitValue: e.target.value } : x))} />
                    <select className="form-input" value={f.limitType}
                      onChange={e => setFeatures(prev => prev.map((x, xi) => xi === i ? { ...x, limitType: e.target.value as 'HARD' | 'SOFT' } : x))}>
                      <option value="HARD">HARD</option>
                      <option value="SOFT">SOFT</option>
                    </select>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '6px' }}
                      onClick={() => setFeatures(prev => prev.filter((_, xi) => xi !== i))}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => setFeatures(prev => [...prev, { featureKey: '', limitValue: '-1', limitType: 'HARD' }])}>
                  <Plus size={13} /> Add Feature
                </button>
              </div>
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? <><div className="spinner" />Saving...</> : plan ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function PlansPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => planApi.list(),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => planApi.archive(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans'] }); toast.success('Plan archived'); },
    onError: () => toast.error('Failed to archive plan'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => planApi.update(id, { isActive: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans'] }); toast.success('Plan reactivated'); },
    onError: () => toast.error('Failed to reactivate plan'),
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading plans...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Plans</h2>
          <p>Manage your billing plans and pricing tiers</p>
        </div>
        <button className="btn btn-primary" id="btn-new-plan" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Plan
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {plans?.map((plan: Plan) => (
          <div key={plan.id} className="card" style={{ display: 'flex', flexDirection: 'column', opacity: plan.isActive ? 1 : 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="stat-icon accent">
                <Package size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{plan.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {plan.slug}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditPlan(plan)} id={`edit-plan-${plan.id}`}>
                  <Pencil size={13} />
                </button>
                {plan.isActive ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => archiveMutation.mutate(plan.id)} id={`archive-plan-${plan.id}`}>
                    <Archive size={13} />
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => reactivateMutation.mutate(plan.id)} id={`reactivate-plan-${plan.id}`}>
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 800 }}>{formatCurrency(plan.priceMonthly, plan.currency)}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/month</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                {formatCurrency(plan.priceYearly, plan.currency)}/year
              </div>
            </div>

            <div style={{ flex: 1 }}>
              {plan.features?.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-primary)', fontSize: 14 }}>
                  <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{f.featureKey.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: 600, color: f.limitValue === -1 ? 'var(--success)' : 'var(--text-primary)', fontSize: 13 }}>
                    {f.limitValue === -1 ? '∞' : f.limitValue.toLocaleString()}
                  </span>
                  <span className={`badge ${f.limitType === 'HARD' ? 'cancelled' : 'trialing'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                    {f.limitType}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <span className={`badge ${plan.isActive ? 'active' : 'cancelled'}`}>
                <span className="badge-dot" />{plan.isActive ? 'Active' : 'Archived'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{plan.interval}</span>
            </div>
          </div>
        ))}

        {(!plans || plans.length === 0) && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state">
              <Package size={40} />
              <h3>No Plans Yet</h3>
              <p>Create your first billing plan to get started</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
                <Plus size={16} /> Create Plan
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <PlanModal onClose={() => setShowCreate(false)} />}
      {editPlan && <PlanModal plan={editPlan} onClose={() => setEditPlan(null)} />}
    </div>
  );
}
