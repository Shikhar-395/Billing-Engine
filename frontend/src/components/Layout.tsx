import { LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  Package,
  BarChart3,
  FileText,
  Wallet,
  Webhook,
  ScrollText,
  Braces,
} from 'lucide-react';
import { authClient, useAuthSession } from '../lib/auth';
import { clearTenantId, getTenantId } from '../lib/api';

const navItems = [
  { section: 'Overview' },
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },

  { section: 'Billing' },
  { to: '/plans', icon: Package, label: 'Plans' },
  { to: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { to: '/usage', icon: BarChart3, label: 'Usage' },

  { section: 'Finance' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/payments', icon: Wallet, label: 'Payments' },

  { section: 'Developer' },
  { to: '/webhooks', icon: Webhook, label: 'Webhooks' },
  { to: '/audit-logs', icon: ScrollText, label: 'Audit Logs' },
];

export default function Layout() {
  const navigate = useNavigate();
  const { data: session } = useAuthSession();

  const activeTenant =
    session?.memberships.find(
      (membership) => membership.tenantId === getTenantId()
    ) ?? session?.memberships[0];

  const handleSignOut = async () => {
    await authClient.signOut();
    clearTenantId();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Braces size={20} />
          </div>
          <div>
            <h1>BillFlow</h1>
            <span>Billing Engine</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) =>
            'section' in item && !('to' in item) ? (
              <div key={i} className="sidebar-section-title">
                {item.section}
              </div>
            ) : 'to' in item ? (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                {item.icon && <item.icon size={18} />}
                {item.label}
              </NavLink>
            ) : null
          )}
        </nav>

        <div className="sidebar-footer">
          <span className="runtime-pill">v0.1 Billing Core</span>
          <code>{activeTenant ? `${activeTenant.tenant.slug} / ${activeTenant.role}` : 'usage:@stream'}</code>
          <div className="sidebar-user">
            <div>
              <strong>{session?.user.name || 'Signed in'}</strong>
              <span>{session?.user.email || 'account@billflow.dev'}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
