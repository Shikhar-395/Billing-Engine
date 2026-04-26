import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthSession } from './lib/auth';
import { setTenantId, getTenantId } from './lib/api';
import { ToastProvider } from './components/Toast';

// Layout
import Layout from './components/Layout';

// Auth pages (public)
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import VerifyEmailPage from './pages/VerifyEmail';
import ForgotPasswordPage from './pages/ForgotPassword';
import ResetPasswordPage from './pages/ResetPassword';
import AcceptInvitationPage from './pages/AcceptInvitation';

// Protected pages
import DashboardPage from './pages/Dashboard';
import PlansPage from './pages/Plans';
import SubscriptionsPage from './pages/Subscriptions';
import InvoicesPage from './pages/Invoices';
import PaymentsPage from './pages/Payments';
import UsagePage from './pages/Usage';
import WebhooksPage from './pages/Webhooks';
import AuditLogsPage from './pages/AuditLogs';
import CustomersPage from './pages/Customers';
import TeamPage from './pages/Team';
import SettingsPage from './pages/Settings';
import DevMailboxPage from './pages/DevMailbox';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ── Boot screen ───────────────────────────────────────────
function BootScreen() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      background: 'var(--bg-primary)',
    }}>
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading BillFlow...</p>
    </div>
  );
}

// ── App shell (session-aware) ─────────────────────────────
function AppShell() {
  const { data: session, isPending } = useAuthSession();
  const [tenantReady, setTenantReady] = useState(!!getTenantId());

  useEffect(() => {
    if (!session) return;

    // Auto-select tenant: prefer stored, fall back to first membership
    const stored = getTenantId();
    const hasMembership = session.memberships.some(m => m.tenantId === stored);

    if (!stored || !hasMembership) {
      const first = session.memberships[0];
      if (first) {
        setTenantId(first.tenantId);
        setTenantReady(true);
      }
    } else {
      setTenantReady(true);
    }
  }, [session]);

  if (isPending) return <BootScreen />;

  const isAuthenticated = !!session;

  // Public routes always accessible
  const publicRoutes = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );

  if (!isAuthenticated) {
    return (
      <Routes>
        {/* Allow accept-invitation and reset-password even unauthenticated */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!tenantReady) return <BootScreen />;

  return (
    <Routes>
      {/* Public auth pages (redirect to dashboard if already logged in) */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<Navigate to="/" replace />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

      {/* Protected layout */}
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {import.meta.env.DEV && (
          <Route path="dev-mailbox" element={<DevMailboxPage />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

// ── Root ──────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
