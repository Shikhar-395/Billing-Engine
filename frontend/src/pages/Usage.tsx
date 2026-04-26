import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart3, Plus, Zap, Users } from 'lucide-react';
import { usageApi, customerApi, subscriptionApi } from '../lib/api';
import type { Customer, Subscription, UsageMetric } from '../types';
import { useToast } from '../components/Toast';

export default function UsagePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [customerId, setCustomerId] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [metricKey, setMetricKey] = useState('api_calls');
  const [quantity, setQuantity] = useState(1);
  const [filterCustomerId, setFilterCustomerId] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', {}],
    queryFn: () => customerApi.list({ status: 'ACTIVE' }),
  });

  const { data: customerSubs = [] } = useQuery({
    queryKey: ['subscriptions', { customerId }],
    queryFn: () => subscriptionApi.list({ customerId }),
    enabled: !!customerId,
  });

  const { data: usageData, isLoading } = useQuery({
    queryKey: ['usage', { customerId: filterCustomerId }],
    queryFn: () => usageApi.summary({ customerId: filterCustomerId || undefined }),
  });

  const recordMutation = useMutation({
    mutationFn: () => usageApi.record({
      customerId,
      subscriptionId: subscriptionId || undefined,
      metricKey,
      quantity,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      toast.success(`Recorded ${quantity} ${metricKey} — window total: ${data.currentWindowCount}`);
      setCustomerId('');
      setSubscriptionId('');
    },
    onError: () => toast.error('Failed to record usage'),
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading usage...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Usage Metering</h2>
        <p>Track and manage resource consumption across customers and metrics</p>
      </div>

      {/* Record Usage Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} style={{ color: 'var(--accent-primary)' }} />
            Record Usage Event
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="usage-customer">Customer *</label>
            <select
              id="usage-customer"
              className="form-input"
              value={customerId}
              onChange={e => { setCustomerId(e.target.value); setSubscriptionId(''); }}
              required
            >
              <option value="">Select customer...</option>
              {customers.map((c: Customer) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="usage-subscription">Subscription (optional)</label>
            <select
              id="usage-subscription"
              className="form-input"
              value={subscriptionId}
              onChange={e => setSubscriptionId(e.target.value)}
              disabled={!customerId}
            >
              <option value="">None</option>
              {customerSubs.map((s: Subscription) => (
                <option key={s.id} value={s.id}>{s.plan?.name ?? s.id.slice(0, 8)} — {s.status}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="usage-metric">Metric Key</label>
            <input
              id="usage-metric"
              className="form-input"
              value={metricKey}
              onChange={e => setMetricKey(e.target.value)}
              placeholder="e.g., api_calls"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="usage-quantity">Quantity</label>
            <input
              id="usage-quantity"
              className="form-input"
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
            />
          </div>

          <button
            className="btn btn-primary"
            id="btn-record-usage"
            onClick={() => recordMutation.mutate()}
            disabled={recordMutation.isPending || !customerId || !metricKey}
            style={{ height: 42, alignSelf: 'flex-end' }}
          >
            {recordMutation.isPending ? <div className="spinner" /> : <Plus size={16} />}
            Record
          </button>
        </div>
      </div>

      {/* Customer filter for summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Users size={16} style={{ color: 'var(--text-muted)' }} />
        <select
          className="form-input"
          style={{ width: 'auto', minWidth: 220 }}
          value={filterCustomerId}
          onChange={e => setFilterCustomerId(e.target.value)}
          id="usage-filter-customer"
        >
          <option value="">All customers</option>
          {customers.map((c: Customer) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Last 30 days</span>
      </div>

      {/* Usage Table */}
      {usageData?.metrics && usageData.metrics.length > 0 ? (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Metric</th>
                  <th>Persisted</th>
                  <th>Live (current window)</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {usageData.metrics.map((metric: UsageMetric, i: number) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{metric.customerName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{metric.customerEmail ?? ''}</div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {metric.metricKey}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {metric.persistedQuantity.toLocaleString()}
                    </td>
                    <td>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: 13 }}>
                        {metric.currentWindowQuantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="money" style={{ fontSize: 15 }}>
                      {metric.totalQuantity.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <BarChart3 size={40} />
            <h3>No Usage Data</h3>
            <p>Record usage events to see metrics here</p>
          </div>
        </div>
      )}
    </div>
  );
}
