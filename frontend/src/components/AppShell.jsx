import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', module: 'management' },
  { to: '/tender-bid', label: 'Tender / Bid', module: 'tender_bid' },
  { to: '/work-orders', label: 'Work Orders', module: 'sales' },
  { to: '/vendor-pos', label: 'Vendor POs', module: 'purchase' },
  { to: '/stock', label: 'Stores / Inventory', module: 'stores' },
  { to: '/production', label: 'Production', module: 'production' },
  { to: '/quality', label: 'Quality', module: 'quality' },
  { to: '/dispatch-accounts', label: 'Dispatch / Accounts', module: 'dispatch_accounts' },
  { to: '/monthly-review', label: 'Monthly Review', module: 'management' },
  { to: '/clients', label: 'Clients', module: null },       // master data — everyone can view
  { to: '/vendors', label: 'Vendors', module: null },
  { to: '/parts', label: 'Parts', module: null },
  { to: '/users', label: 'Users', roleOnly: ['superadmin', 'module_admin'] },
];

export default function AppShell() {
  const { user, logout, hasModule } = useAuth();
  const navigate = useNavigate();
  const [enabledModules, setEnabledModules] = useState(null); // null = still loading

  useEffect(() => {
    api.get('/enabled-modules').then(({ data }) => {
      setEnabledModules(new Set(data.filter((m) => m.is_enabled).map((m) => m.module)));
    }).catch(() => setEnabledModules(new Set())); // fail closed, not open
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">AI</span>
          <div>
            <div className="brand-name">Order Management</div>
            <div className="brand-sub">Arieckal Industries</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {enabledModules && NAV_ITEMS.filter((item) => {
            if (item.roleOnly) return item.roleOnly.includes(user?.role);
            if (item.module) return enabledModules.has(item.module) && hasModule(item.module);
            return true;
          }).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
