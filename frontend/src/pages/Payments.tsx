import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { paymentApi } from '../lib/api';
import { formatCurrency, formatDate, relativeTime } from '../lib/utils';

export default function PaymentsPage() {
  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentApi.list({ limit: 50 }),
  });

  if (isLoading) return <div className="loading-page"><div className="spinner" /> Loading payments...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Payments</h2>
        <p>Track all payment transactions</p>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Stripe ID</th>
                <th>Processed</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {payments?.map((pay) => (
                <tr key={pay.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                    {pay.id.slice(0, 8)}
                  </td>
                  <td className="money">{formatCurrency(pay.amount, pay.currency)}</td>
                  <td>
                    <span className={`badge ${pay.status.toLowerCase()}`}>
                      <span className="badge-dot" />
                      {pay.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                    {pay.stripePaymentIntentId?.slice(0, 16) || '—'}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {pay.processedAt ? formatDate(pay.processedAt) : '—'}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {relativeTime(pay.createdAt)}
                  </td>
                </tr>
              ))}
              {(!payments || payments.length === 0) && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    <Wallet size={40} />
                    <h3>No Payments</h3>
                    <p>Payments will appear here when invoices are paid</p>
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
