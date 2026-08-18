import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', module: 'management' },
  { to: '/clients', label: 'Clients', module: null },       // master data — everyone can view
  { to: '/vendors', label: 'Vendors', module: null },
  { to: '/parts', label: 'Parts', module: null },
  { to: '/users', label: 'Users', roleOnly: ['superadmin', 'module_admin'] },
];

export default function AppShell() {
  const { user, logout, hasModule } = useAuth();
  const navigate = useNavigate();

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
          {NAV_ITEMS.filter((item) => {
            if (item.roleOnly) return item.roleOnly.includes(user?.role);
            if (item.module) return hasModule(item.module);
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
