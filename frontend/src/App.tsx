import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';

import Layout from './components/Layout';
import DashboardPage from './pages/Dashboard';
import PlansPage from './pages/Plans';
import SubscriptionsPage from './pages/Subscriptions';
import UsagePage from './pages/Usage';
import InvoicesPage from './pages/Invoices';
import PaymentsPage from './pages/Payments';
import WebhooksPage from './pages/Webhooks';
import AuditLogsPage from './pages/AuditLogs';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import OnboardingPage from './pages/Onboarding';
import { clearTenantId, getTenantId, setTenantId } from './lib/api';
import { type AuthSessionData, useAuthSession } from './lib/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      retry: 1,
    },
  },
});

function BootScreen({
  message,
  detail,
}: {
  message: string;
  detail?: string;
}) {
  return (
    <div className="boot-screen">
      <div className="boot-panel" aria-live="polite" aria-busy="true">
        <div className="spinner spinner-lg" />
        <span>{message}</span>
        {detail ? <code>{detail}</code> : null}
      </div>
    </div>
  );
}

function SessionRouter({ session }: { session: AuthSessionData | null }) {
  useEffect(() => {
    if (!session || !session.onboardingComplete) {
      clearTenantId();
      return;
    }

    const currentTenantId = getTenantId();
    const memberships = session.memberships;
    const fallbackTenantId =
      memberships.find((membership) => membership.tenantId === currentTenantId)
        ?.tenantId ??
      session.currentTenantId ??
      memberships[0]?.tenantId;

    if (fallbackTenantId) {
      setTenantId(fallbackTenantId);
    }
  }, [session]);

  const isAuthenticated = Boolean(session);
  const onboardingComplete = Boolean(session?.onboardingComplete);

  return (
    <Routes>
      {!isAuthenticated ? (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<Navigate replace to="/login" />} />
        </>
      ) : !onboardingComplete ? (
        <>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate replace to="/onboarding" />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<Navigate replace to="/" />} />
          <Route path="/signup" element={<Navigate replace to="/" />} />
          <Route path="/onboarding" element={<Navigate replace to="/" />} />
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
          <Route path="*" element={<Navigate replace to="/" />} />
        </>
      )}
    </Routes>
  );
}

function AppShell() {
  const { data: session, isPending } = useAuthSession();

  if (isPending) {
    return (
      <BootScreen
        message="Connecting to billing system..."
        detail="auth:session / tenancy:resolve"
      />
    );
  }

  return (
    <BrowserRouter>
      <SessionRouter session={session} />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
