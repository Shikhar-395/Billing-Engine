import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { setTenantId, tenantApi } from './lib/api';

import Layout from './components/Layout';
import DashboardPage from './pages/Dashboard';
import PlansPage from './pages/Plans';
import SubscriptionsPage from './pages/Subscriptions';
import UsagePage from './pages/Usage';
import InvoicesPage from './pages/Invoices';
import PaymentsPage from './pages/Payments';
import WebhooksPage from './pages/Webhooks';
import AuditLogsPage from './pages/AuditLogs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
    },
  },
});

function TenantBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    // Auto-discover or create a dev tenant
    async function init() {
      setReady(false);
      setBootstrapError('');

      try {
        // Try creating a default dev tenant
        const tenant = await tenantApi.create({
          name: 'Demo Tenant',
          slug: 'demo-tenant',
        });
        setTenantId(tenant.id);
      } catch {
        // If slug conflict, fetch by listing
        try {
          const res = await fetch('/api/v1/plans');
          if (!res.ok) {
            throw new Error('Plan lookup failed');
          }
          const plans = (await res.json()) as { data?: Array<{ tenantId: string }> };
          const tenantId = plans.data?.[0]?.tenantId;
          if (!tenantId) {
            throw new Error('No tenant discovered');
          }
          setTenantId(tenantId);
          await tenantApi.get(tenantId);
        } catch {
          // Fallback: create with unique slug
          const tenant = await tenantApi.create({
            name: 'Demo Tenant',
            slug: `demo-${Date.now()}`,
          });
          setTenantId(tenant.id);
        }
      }
      if (isMounted) {
        setReady(true);
      }
    }

    init().catch(() => {
      if (isMounted) {
        setBootstrapError('Billing API is not reachable. Start the backend on port 4000, then retry.');
        setReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [attempt]);

  if (!ready) {
    return (
      <div className="boot-screen">
        <div className="boot-panel" aria-live="polite" aria-busy="true">
          <div className="spinner spinner-lg" />
          <span>Connecting to billing system...</span>
          <code>tenant:auto / ledger:warm</code>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="boot-screen">
        <div className="boot-panel boot-panel-error" role="alert">
          <span>Billing system did not respond</span>
          <p>{bootstrapError}</p>
          <button className="btn btn-primary btn-sm" onClick={() => setAttempt((value) => value + 1)}>
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantBootstrap>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/usage" element={<UsagePage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/webhooks" element={<WebhooksPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TenantBootstrap>
    </QueryClientProvider>
  );
}
