import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart3, Plus, Zap } from 'lucide-react';
import { usageApi } from '../lib/api';
import type { UsageMetric } from '../types';

export default function UsagePage() {
  const queryClient = useQueryClient();
  const [metricKey, setMetricKey] = useState('api_calls');
  const [quantity, setQuantity] = useState(1);

  const { data: usageData, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: usageApi.summary,
  });

  const recordMutation = useMutation({
    mutationFn: () => usageApi.record({ metricKey, quantity }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usage'] }),
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading usage...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Usage Metering</h2>
        <p>Track and manage resource consumption across metrics</p>
      </div>

      {/* Record Usage Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} style={{ color: 'var(--accent-primary)' }} />
            Record Usage Event
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label">Metric Key</label>
            <input
              className="form-input"
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              placeholder="e.g., api_calls"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, width: 120 }}>
            <label className="form-label">Quantity</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => recordMutation.mutate()}
            disabled={recordMutation.isPending}
            style={{ height: 42 }}
          >
            {recordMutation.isPending ? (
              <div className="spinner" />
            ) : (
              <Plus size={16} />
            )}
            Record
          </button>
        </div>
        {recordMutation.isSuccess && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--success)',
            }}
          >
            ✓ Recorded {quantity} {metricKey} — window count: {(recordMutation.data as any)?.currentWindowCount}
          </div>
        )}
      </div>

      {/* Usage Metrics Grid */}
      <div className="stats-grid">
        {usageData?.metrics?.map((metric: UsageMetric) => (
          <div key={metric.metricKey} className="stat-card">
            <div className="stat-icon blue">
              <BarChart3 size={24} />
            </div>
            <div className="stat-info" style={{ flex: 1 }}>
              <h3>{metric.totalQuantity.toLocaleString()}</h3>
              <p style={{ textTransform: 'capitalize' }}>{metric.metricKey.replace(/_/g, ' ')}</p>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Persisted: </span>
                  <span style={{ fontWeight: 600 }}>{metric.persistedQuantity.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Live: </span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {metric.currentWindowQuantity.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {(!usageData?.metrics || usageData.metrics.length === 0) && (
          <div className="card empty-state" style={{ gridColumn: '1 / -1' }}>
            <BarChart3 size={40} />
            <h3>No Usage Data</h3>
            <p>Record usage events to see metrics here</p>
          </div>
        )}
      </div>
    </div>
  );
}
