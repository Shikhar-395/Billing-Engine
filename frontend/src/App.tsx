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

// ── Skeleton shimmer block ────────────────────────────────
function Skeleton({ w, h, r = 6, mb = 0 }: { w: string | number; h: string | number; r?: number; mb?: number }) {
  return (
    <div
      className="skeleton-pulse"
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        borderRadius: r,
        marginBottom: mb,
        background: 'var(--border-primary)',
        flexShrink: 0,
      }}
    />
  );
}

// ── Boot screen (skeleton layout) ─────────────────────────
function BootScreen() {
  return (
    <div className="skeleton-boot">
      {/* Sidebar skeleton */}
      <aside className="skeleton-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 16px', borderBottom: '1px solid var(--border-primary)' }}>
          <Skeleton w={32} h={32} r={8} />
          <div>
            <Skeleton w={72} h={12} mb={6} />
            <Skeleton w={52} h={8} />
          </div>
        </div>

        <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton w={60} h={8} mb={8} />
          {[120, 96, 108].map((w, i) => (
            <Skeleton key={`a${i}`} w={w} h={32} r={6} />
          ))}
          <Skeleton w={60} h={8} mb={8} />
          {[104, 118, 88].map((w, i) => (
            <Skeleton key={`b${i}`} w={w} h={32} r={6} />
          ))}
          <Skeleton w={60} h={8} mb={8} />
          {[96, 110].map((w, i) => (
            <Skeleton key={`c${i}`} w={w} h={32} r={6} />
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid var(--border-primary)' }}>
          <Skeleton w="100%" h={36} r={6} mb={10} />
          <Skeleton w="100%" h={14} r={4} />
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="skeleton-main">
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <Skeleton w={180} h={22} mb={8} />
          <Skeleton w={280} h={14} />
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <Skeleton w={44} h={44} r={8} />
                <div style={{ flex: 1 }}>
                  <Skeleton w="60%" h={24} mb={6} />
                  <Skeleton w="80%" h={12} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="skeleton-card" style={{ padding: 0 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton w={140} h={16} />
            <Skeleton w={100} h={32} r={6} />
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              style={{
                padding: '14px 24px',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                gap: 24,
                alignItems: 'center',
              }}
            >
              <Skeleton w="25%" h={14} />
              <Skeleton w="20%" h={14} />
              <Skeleton w="15%" h={24} r={12} />
              <Skeleton w="20%" h={14} />
              <Skeleton w="10%" h={14} />
            </div>
          ))}
        </div>
      </main>
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
