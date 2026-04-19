import { NavLink, Outlet } from 'react-router-dom';
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
          <code>usage:@stream</code>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
