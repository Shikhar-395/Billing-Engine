import { useState } from 'react';
import { LogOut, ChevronDown, Check } from 'lucide-react';
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
  Users,
  UsersRound,
  Settings,
  Mail,
} from 'lucide-react';
import { authClient, useAuthSession } from '../lib/auth';
import { clearTenantId, getTenantId, setTenantId } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

const navItems = [
  { section: 'Overview' },
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: Users, label: 'Customers' },

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
  ...(import.meta.env.DEV ? [{ to: '/dev-mailbox', icon: Mail, label: 'Dev Mailbox' }] : []),

  { section: 'Workspace' },
  { to: '/team', icon: UsersRound, label: 'Team' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useAuthSession();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const currentTenantId = getTenantId();
  const activeTenant =
    session?.memberships.find(m => m.tenantId === currentTenantId) ??
    session?.memberships[0];

  const handleSignOut = async () => {
    await authClient.signOut();
    clearTenantId();
    navigate('/login');
  };

  const handleSwitchTenant = (tenantId: string) => {
    setTenantId(tenantId);
    setSwitcherOpen(false);
    queryClient.invalidateQueries();
    navigate('/');
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
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {item.icon && <item.icon size={18} />}
                {item.label}
              </NavLink>
            ) : null
          )}
        </nav>

        <div className="sidebar-footer">
          {/* Tenant Switcher */}
          {session && session.memberships.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'space-between', padding: '8px 10px' }}
                onClick={() => setSwitcherOpen(o => !o)}
                id="tenant-switcher"
                aria-expanded={switcherOpen}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                    {activeTenant?.tenant.name ?? 'Workspace'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {activeTenant?.tenant.slug}
                  </span>
                </div>
                <ChevronDown size={14} style={{ flexShrink: 0, transition: 'transform 150ms', transform: switcherOpen ? 'rotate(180deg)' : 'none' }} />
              </button>

              {switcherOpen && session.memberships.length > 1 && (
                <div
                  className="dropdown-menu"
                  style={{ bottom: '100%', top: 'auto', marginBottom: 4, width: '100%' }}
                >
                  {session.memberships.map(m => (
                    <button
                      key={m.tenantId}
                      className="dropdown-item"
                      onClick={() => handleSwitchTenant(m.tenantId)}
                      id={`switch-tenant-${m.tenantId}`}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.tenant.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.tenant.slug}</div>
                      </div>
                      {m.tenantId === currentTenantId && <Check size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <span className="runtime-pill">v0.2 Billing Core</span>
          <div className="sidebar-user">
            <div>
              <strong>{session?.user.name || 'Signed in'}</strong>
              <span>{session?.user.email || 'account@billflow.dev'}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut} id="btn-signout">
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
