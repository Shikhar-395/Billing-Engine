import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { invoiceApi } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';

export default function InvoicesPage() {
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.list({ limit: 50 }),
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading invoices...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <p>View and manage all generated invoices</p>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Plan</th>
                <th>Subtotal</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {invoicesData?.data?.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {inv.id.slice(0, 8)}
                  </td>
                  <td>{inv.subscription?.plan?.name || '—'}</td>
                  <td className="money">{formatCurrency(inv.subtotal, inv.currency)}</td>
                  <td className="money" style={{ color: 'var(--text-muted)' }}>{formatCurrency(inv.tax, inv.currency)}</td>
                  <td className="money">{formatCurrency(inv.total, inv.currency)}</td>
                  <td>
                    <span className={`badge ${inv.status.toLowerCase()}`}>
                      <span className="badge-dot" />
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {inv.dueAt ? formatDate(inv.dueAt) : '—'}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {formatDate(inv.createdAt)}
                  </td>
                </tr>
              ))}
              {(!invoicesData?.data || invoicesData.data.length === 0) && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    <FileText size={40} />
                    <h3>No Invoices</h3>
                    <p>Invoices will appear here when subscriptions are billed</p>
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
