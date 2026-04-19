import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Webhook, Plus, Trash2, Globe, X } from 'lucide-react';
import { webhookApi } from '../lib/api';
import { formatDate, relativeTime } from '../lib/utils';
import type { WebhookEndpoint, WebhookDelivery } from '../types';

const EVENT_TYPES = [
  'subscription.created',
  'subscription.cancelled',
  'subscription.upgraded',
  'invoice.paid',
  'invoice.voided',
  'dunning.started',
  'dunning.exhausted',
  '*',
];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const { data: endpoints, isLoading } = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: webhookApi.listEndpoints,
  });

  const { data: deliveries } = useQuery({
    queryKey: ['webhook-deliveries'],
    queryFn: () => webhookApi.listDeliveries({}),
  });

  const createMutation = useMutation({
    mutationFn: () => webhookApi.createEndpoint({ url, eventTypes: selectedEvents }),
    onSuccess: (data) => {
      setCreatedSecret(data.signingSecret || null);
      setShowCreate(false);
      setUrl('');
      setSelectedEvents([]);
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhookApi.deleteEndpoint(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] }),
  });

  const toggleEvent = (evt: string) => {
    setSelectedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    );
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Webhooks</h2>
          <p>Manage webhook endpoints and delivery logs</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Endpoint
        </button>
      </div>

      {/* Secret Alert */}
      {createdSecret && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            background: 'var(--warning-bg)',
            borderColor: 'var(--warning-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, color: 'var(--warning)' }}>⚠ Signing Secret — Copy it now!</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreatedSecret(null)}>
              <X size={14} />
            </button>
          </div>
          <code
            style={{
              display: 'block',
              padding: 12,
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all',
              color: 'var(--text-primary)',
            }}
          >
            {createdSecret}
          </code>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            This secret will not be shown again. Use it to verify webhook signatures.
          </p>
        </div>
      )}

      {/* Endpoints Table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Endpoints</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Events</th>
                <th>Deliveries</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {endpoints?.map((ep: WebhookEndpoint) => (
                <tr key={ep.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Globe size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{ep.url}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(ep.eventTypes as string[]).slice(0, 3).map((evt) => (
                        <span key={evt} className="badge trialing" style={{ fontSize: 10, padding: '2px 6px' }}>
                          {evt}
                        </span>
                      ))}
                      {(ep.eventTypes as string[]).length > 3 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          +{(ep.eventTypes as string[]).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ep._count?.deliveries || 0}</td>
                  <td>
                    <span className={`badge ${ep.isActive ? 'active' : 'cancelled'}`}>
                      <span className="badge-dot" />
                      {ep.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{relativeTime(ep.createdAt)}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteMutation.mutate(ep.id)}
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {(!endpoints || endpoints.length === 0) && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    <Webhook size={40} />
                    <h3>No Webhook Endpoints</h3>
                    <p>Add an endpoint to receive billing events</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Deliveries */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Deliveries</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Endpoint</th>
                <th>HTTP Status</th>
                <th>Attempts</th>
                <th>Delivered</th>
              </tr>
            </thead>
            <tbody>
              {deliveries?.map((d: WebhookDelivery) => (
                <tr key={d.id}>
                  <td>
                    <span className="badge trialing" style={{ fontSize: 11 }}>{d.eventType}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                    {d.endpoint?.url || d.endpointId.slice(0, 8)}
                  </td>
                  <td>
                    {d.httpStatus ? (
                      <span className={`badge ${d.httpStatus < 300 ? 'active' : 'cancelled'}`} style={{ fontSize: 11 }}>
                        {d.httpStatus}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>{d.attemptCount}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {d.lastAttemptAt ? relativeTime(d.lastAttemptAt) : 'Pending'}
                  </td>
                </tr>
              ))}
              {(!deliveries || deliveries.length === 0) && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    <p>No deliveries yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Webhook Endpoint</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Endpoint URL</label>
              <input
                className="form-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.com/webhook"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event Types</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EVENT_TYPES.map((evt) => (
                  <button
                    key={evt}
                    className={`btn btn-sm ${selectedEvents.includes(evt) ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleEvent(evt)}
                    style={{ fontSize: 12 }}
                  >
                    {evt}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => createMutation.mutate()}
              disabled={!url || selectedEvents.length === 0 || createMutation.isPending}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            >
              {createMutation.isPending ? <div className="spinner" /> : <Plus size={16} />}
              Create Endpoint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
