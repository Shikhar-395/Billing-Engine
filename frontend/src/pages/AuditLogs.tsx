import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { ScrollText, ChevronDown, ChevronRight } from 'lucide-react';
import { auditApi } from '../lib/api';
import { formatDateTime, relativeTime } from '../lib/utils';
import type { AuditLog } from '../types';

export default function AuditLogsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState('');

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['audit-logs', filterEntity],
    queryFn: () => auditApi.list({ entityType: filterEntity || undefined, limit: 50 }),
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading audit logs...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Audit Logs</h2>
        <p>Immutable record of all billing system changes</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
            Filter by Entity:
          </label>
          <select
            className="form-input"
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">All Entities</option>
            <option value="Subscription">Subscription</option>
            <option value="Invoice">Invoice</option>
            <option value="Plan">Plan</option>
            <option value="Tenant">Tenant</option>
            <option value="Payment">Payment</option>
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {logsData?.meta?.total || 0} total entries
          </span>
        </div>
      </div>

      {/* Logs */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logsData?.data?.map((log: AuditLog) => (
                <Fragment key={log.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      {expandedId === log.id ? (
                        <ChevronDown size={14} style={{ color: 'var(--accent-primary)' }} />
                      ) : (
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </td>
                    <td>
                      <span className="badge trialing" style={{ fontSize: 11 }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.entityType}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                      {log.entityId.slice(0, 8)}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      <span title={formatDateTime(log.createdAt)}>{relativeTime(log.createdAt)}</span>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 16,
                            padding: 20,
                            background: 'var(--bg-secondary)',
                            borderTop: '1px solid var(--border-primary)',
                          }}
                        >
                          <div>
                            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0 }}>
                              Before
                            </h4>
                            <pre
                              style={{
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                background: 'var(--bg-primary)',
                                padding: 12,
                                borderRadius: 'var(--radius-md)',
                                overflow: 'auto',
                                maxHeight: 300,
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-primary)',
                              }}
                            >
                              {JSON.stringify(log.before, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0 }}>
                              After
                            </h4>
                            <pre
                              style={{
                                fontSize: 12,
                                fontFamily: 'var(--font-mono)',
                                background: 'var(--bg-primary)',
                                padding: 12,
                                borderRadius: 'var(--radius-md)',
                                overflow: 'auto',
                                maxHeight: 300,
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-primary)',
                              }}
                            >
                              {JSON.stringify(log.after, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {(!logsData?.data || logsData.data.length === 0) && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    <ScrollText size={40} />
                    <h3>No Audit Logs</h3>
                    <p>Changes to subscriptions, invoices, and plans will be logged here</p>
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
