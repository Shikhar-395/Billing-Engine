import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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

function TenantBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    // Auto-discover or create a dev tenant
    async function init() {
      try {
        // Try creating a default dev tenant
        const tenant = await tenantApi.create({
          name: 'Demo Tenant',
          slug: 'demo-tenant',
        });
        setTenantId(tenant.id);
        setTenantName(tenant.name);
      } catch {
        // If slug conflict, fetch by listing
        try {
          const res = await fetch('/api/v1/plans');
          const plans = await res.json();
          if (plans.data?.length > 0) {
            const tenantId = plans.data[0].tenantId;
            setTenantId(tenantId);
            const tenant = await tenantApi.get(tenantId);
            setTenantName(tenant.name);
          }
        } catch {
          // Fallback: create with unique slug
          const tenant = await tenantApi.create({
            name: 'Demo Tenant',
            slug: `demo-${Date.now()}`,
          });
          setTenantId(tenant.id);
          setTenantName(tenant.name);
        }
      }
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 16,
        color: 'var(--text-muted)',
        flexDirection: 'column',
      }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span>Connecting to billing engine...</span>
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
