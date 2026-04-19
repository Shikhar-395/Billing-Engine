import { useQuery } from '@tanstack/react-query';
import { Package, Check } from 'lucide-react';
import { planApi } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import type { Plan } from '../types';

export default function PlansPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: planApi.list,
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading plans...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Plans</h2>
        <p>Manage your billing plans and pricing tiers</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {plans?.map((plan: Plan) => (
          <div key={plan.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="stat-icon accent">
                <Package size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{plan.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {plan.slug}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: 0 }}>
                  {formatCurrency(plan.priceMonthly, plan.currency)}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/month</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                {formatCurrency(plan.priceYearly, plan.currency)}/year
              </div>
            </div>

            <div style={{ flex: 1 }}>
              {plan.features?.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-primary)',
                    fontSize: 14,
                  }}
                >
                  <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{f.featureKey.replace(/_/g, ' ')}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: f.limitValue === -1 ? 'var(--success)' : 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  >
                    {f.limitValue === -1 ? 'Unlimited' : f.limitValue.toLocaleString()}
                  </span>
                  <span className={`badge ${f.limitType === 'HARD' ? 'cancelled' : 'trialing'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                    {f.limitType}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <span className={`badge ${plan.isActive ? 'active' : 'cancelled'}`}>
                <span className="badge-dot" />
                {plan.isActive ? 'Active' : 'Inactive'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {plan.interval}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
