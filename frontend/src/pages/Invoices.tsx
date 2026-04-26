import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Ban, X } from 'lucide-react';
import { invoiceApi } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import type { Invoice } from '../types';
import { useToast } from '../components/Toast';

type StatusFilter = '' | 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Void', value: 'VOID' },
];

// ── Invoice Detail Modal ──────────────────────────────────
function InvoiceDetailModal({ invoice, onClose, onVoid }: {
  invoice: Invoice;
  onClose: () => void;
  onVoid: (id: string) => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['invoice', invoice.id],
    queryFn: () => invoiceApi.get(invoice.id),
    initialData: invoice,
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580, maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ fontFamily: 'var(--font-mono)' }}>{detail?.invoiceNumber ?? invoice.invoiceNumber}</h2>
            <span className={`badge ${detail?.status.toLowerCase() ?? invoice.status.toLowerCase()}`} style={{ marginTop: 4 }}>
              <span className="badge-dot" />{detail?.status ?? invoice.status}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : detail ? (
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Customer */}
            <div style={{ display: 'grid', gap: 4, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Customer</span>
              <span style={{ fontWeight: 600 }}>{detail.customer?.name ?? '—'}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{detail.customer?.email ?? ''}</span>
            </div>

            {/* Plan / Subscription */}
            {detail.subscription?.plan && (
              <div style={{ display: 'grid', gap: 4, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Plan</span>
                <span style={{ fontWeight: 600 }}>{detail.subscription.plan.name}</span>
              </div>
            )}

            {/* Line items */}
            {detail.lineItems && detail.lineItems.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
                  <h4 style={{ fontWeight: 600, fontSize: 14 }}>Line Items</h4>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lineItems.map(item => (
                        <tr key={item.id}>
                          <td>
                            <div>
                              <span>{item.description}</span>
                              <span className={`badge ${item.type === 'TAX' ? 'warning' : 'trialing'}`} style={{ marginLeft: 8, fontSize: 10 }}>{item.type}</span>
                            </div>
                          </td>
                          <td className="money" style={{ textAlign: 'right' }}>{item.quantity}</td>
                          <td className="money" style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice, detail.currency)}</td>
                          <td className="money" style={{ textAlign: 'right' }}>{formatCurrency(item.amount, detail.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-primary)', display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span>Subtotal</span><span className="money">{formatCurrency(detail.subtotal, detail.currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span>Tax</span><span className="money">{formatCurrency(detail.tax, detail.currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--border-primary)' }}>
                    <span>Total</span><span className="money">{formatCurrency(detail.total, detail.currency)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {detail.dueAt && (
                <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Due</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(detail.dueAt)}</div>
                </div>
              )}
              {detail.paidAt && (
                <div style={{ padding: '10px 14px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--success)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Paid</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>{formatDate(detail.paidAt)}</div>
                </div>
              )}
            </div>

            {/* Payments */}
            {detail.payments && detail.payments.length > 0 && (
              <div className="card" style={{ padding: '12px 16px' }}>
                <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Payments</h4>
                {detail.payments.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-primary)', fontSize: 13 }}>
                    <span className={`badge ${p.status.toLowerCase()}`}><span className="badge-dot" />{p.status}</span>
                    <span className="money">{formatCurrency(p.amount, p.currency)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{p.processedAt ? formatDate(p.processedAt) : '—'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Void action */}
            {(detail.status === 'OPEN' || detail.status === 'DRAFT') && (
              <button
                className="btn btn-danger"
                id={`void-invoice-${detail.id}`}
                onClick={() => { onVoid(detail.id); onClose(); }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Ban size={15} /> Void Invoice
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', { status: statusFilter, offset: page * PAGE_SIZE }],
    queryFn: () => invoiceApi.list({ status: statusFilter || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => invoiceApi.void(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice voided'); },
    onError: () => toast.error('Failed to void invoice'),
  });

  const invoices = invoicesData?.data ?? [];
  const total = invoicesData?.meta?.total ?? 0;

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <p>View and manage all generated invoices</p>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-primary)', paddingBottom: 0 }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            className={`btn btn-ghost ${statusFilter === tab.value ? 'active' : ''}`}
            style={{
              borderBottom: statusFilter === tab.value ? '2px solid var(--accent-primary)' : '2px solid transparent',
              borderRadius: 0,
              paddingBottom: 10,
              color: statusFilter === tab.value ? 'var(--accent-primary)' : undefined,
            }}
            onClick={() => { setStatusFilter(tab.value); setPage(0); }}
            id={`invoice-tab-${tab.value || 'all'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-page"><div className="spinner" /> Loading invoices...</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: Invoice) => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setDetailInvoice(inv)}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                      {inv.invoiceNumber}
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.customer?.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.customer?.email ?? ''}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {(inv as Invoice & { subscription?: { plan: { name: string } } }).subscription?.plan?.name ?? '—'}
                    </td>
                    <td className="money">{formatCurrency(inv.total, inv.currency)}</td>
                    <td><span className={`badge ${inv.status.toLowerCase()}`}><span className="badge-dot" />{inv.status}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{inv.dueAt ? formatDate(inv.dueAt) : '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDate(inv.createdAt)}</td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <FileText size={40} />
                        <h3>No Invoices</h3>
                        <p>Invoices are generated automatically when subscriptions are created</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {detailInvoice && (
        <InvoiceDetailModal
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          onVoid={id => voidMutation.mutate(id)}
        />
      )}
    </div>
  );
}
