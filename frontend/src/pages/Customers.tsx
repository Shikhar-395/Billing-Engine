import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Search,
  Archive,
  MoreVertical,
  Mail,
  Building2,
  X,
  ChevronDown,
  CreditCard,
  FileText,
  BarChart3,
} from 'lucide-react';
import { customerApi } from '../lib/api';
import { formatDate, relativeTime, formatCurrency } from '../lib/utils';
import type { Customer, CustomerDetail } from '../types';
import { useToast } from '../components/Toast';

// ── Customer Form Modal ───────────────────────────────────
function CustomerModal({
  customer,
  onClose,
}: {
  customer?: Customer;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    company: customer?.company ?? '',
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: customerApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created successfully');
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to create customer';
      setError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof customerApi.update>[1]) =>
      customerApi.update(customer!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to update customer';
      setError(msg);
      toast.error(msg);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required');
      return;
    }
    const data = {
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim() || undefined,
    };
    if (customer) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{customer ? 'Edit Customer' : 'New Customer'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="cust-name">Full Name *</label>
            <input
              id="cust-name"
              className="form-input"
              placeholder="Acme Corporation"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cust-email">Email Address *</label>
            <input
              id="cust-email"
              type="email"
              className="form-input"
              placeholder="billing@acme.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cust-company">Company</label>
            <input
              id="cust-company"
              className="form-input"
              placeholder="Acme Corp"
              value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? <><div className="spinner" />Saving...</> : customer ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Customer Detail Drawer ────────────────────────────────
function CustomerDetailDrawer({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerApi.get(customerId),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 680, maxHeight: '85vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Customer Detail</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {isLoading && (
          <div className="loading-page"><div className="spinner" /> Loading...</div>
        )}

        {detail && (
          <div style={{ display: 'grid', gap: 24 }}>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { icon: CreditCard, label: 'Subscriptions', value: detail._count?.subscriptions ?? detail.subscriptions.length },
                { icon: FileText, label: 'Invoices', value: detail._count?.invoices ?? detail.invoices.length },
                { icon: BarChart3, label: 'Payments', value: detail._count?.payments ?? detail.payments.length },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="stat-card" style={{ padding: 16 }}>
                  <div className="stat-icon accent"><Icon size={18} /></div>
                  <div className="stat-info">
                    <h3 style={{ fontSize: 22 }}>{value}</h3>
                    <p>{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Usage metrics */}
            {detail.usageMetrics.length > 0 && (
              <div className="card">
                <h4 style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Usage Metrics</h4>
                <div style={{ display: 'grid', gap: 8 }}>
                  {detail.usageMetrics.map(m => (
                    <div key={m.metricKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderBottom: '1px solid var(--border-primary)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.metricKey.replace(/_/g, ' ')}</span>
                      <strong>{m.totalQuantity.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subscriptions */}
            {detail.subscriptions.length > 0 && (
              <div className="card">
                <h4 style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Subscriptions</h4>
                <div style={{ display: 'grid', gap: 10 }}>
                  {detail.subscriptions.map(sub => (
                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14 }}>{sub.plan?.name ?? 'Unknown plan'}</span>
                      <span className={`badge ${sub.status.toLowerCase()}`}>
                        <span className="badge-dot" />{sub.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoices */}
            {detail.invoices.length > 0 && (
              <div className="card">
                <h4 style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Recent Invoices</h4>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.invoices.map(inv => (
                        <tr key={inv.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{inv.invoiceNumber}</td>
                          <td className="money">{formatCurrency(inv.total, inv.currency)}</td>
                          <td><span className={`badge ${inv.status.toLowerCase()}`}><span className="badge-dot" />{inv.status}</span></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(inv.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function CustomersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | ''>('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', { search, status: statusFilter }],
    queryFn: () => customerApi.list({ search: search || undefined, status: statusFilter || undefined }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => customerApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer archived');
    },
    onError: () => toast.error('Failed to archive customer'),
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Customers</h2>
          <p>Manage your billed customers and their billing history</p>
        </div>
        <button className="btn btn-primary" id="btn-new-customer" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Customer
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search customers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="customer-search"
          />
        </div>
        <select
          className="form-input"
          style={{ width: 'auto' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as '' | 'ACTIVE' | 'ARCHIVED')}
          id="customer-status-filter"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="loading-page"><div className="spinner" /> Loading customers...</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Subscriptions</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer: Customer) => (
                  <tr
                    key={customer.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDetailId(customer.id)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'var(--accent-glow)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--accent-primary)', fontWeight: 700, fontSize: 14, flexShrink: 0,
                        }}>
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{customer.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Mail size={11} />{customer.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {customer.company ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={13} />{customer.company}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`badge ${customer.status === 'ACTIVE' ? 'active' : 'cancelled'}`}>
                        <span className="badge-dot" />{customer.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {customer._count?.subscriptions ?? 0}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {relativeTime(customer.createdAt)}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setMenuOpen(menuOpen === customer.id ? null : customer.id)}
                          aria-label="More options"
                          id={`customer-menu-${customer.id}`}
                        >
                          <MoreVertical size={15} />
                        </button>
                        {menuOpen === customer.id && (
                          <div className="dropdown-menu" style={{ right: 0, top: '100%' }}>
                            <button
                              className="dropdown-item"
                              onClick={() => { setEditCustomer(customer); setMenuOpen(null); }}
                            >
                              Edit
                            </button>
                            {customer.status === 'ACTIVE' && (
                              <button
                                className="dropdown-item dropdown-item-danger"
                                onClick={() => { archiveMutation.mutate(customer.id); setMenuOpen(null); }}
                              >
                                <Archive size={13} /> Archive
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <Users size={40} />
                        <h3>No customers yet</h3>
                        <p>Create your first customer to start billing</p>
                        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
                          <Plus size={16} /> New Customer
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status filter pills */}
      {!isLoading && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </span>
          {statusFilter === 'ACTIVE' && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setStatusFilter('')}>
              <ChevronDown size={12} /> Show archived
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && <CustomerModal onClose={() => setShowCreate(false)} />}
      {editCustomer && <CustomerModal customer={editCustomer} onClose={() => setEditCustomer(null)} />}
      {detailId && <CustomerDetailDrawer customerId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
