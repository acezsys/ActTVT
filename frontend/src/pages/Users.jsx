import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import { useAuth } from '../context/AuthContext';

const MODULES = ['tender_bid', 'sales', 'purchase', 'stores', 'production', 'quality', 'dispatch_accounts', 'management'];
const BLANK = { name: '', email: '', job_title: '', role: 'user' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  async function load() {
    const { data } = await api.get('/users');
    setUsers(data);
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    await api.post('/users', form);
    setForm(BLANK);
    setCreating(false);
    load();
  }

  async function toggleModule(userId, moduleName, currentlyGranted) {
    if (currentlyGranted) {
      await api.delete(`/users/${userId}/module-access/${moduleName}`);
    } else {
      await api.post(`/users/${userId}/module-access`, { module: moduleName, can_edit: true });
    }
    load();
  }

  async function handleDeactivate(row) {
    if (!isSuperadmin) return;
    if (!confirm(`Deactivate ${row.name}'s login? Only a superadmin can undo this.`)) return;
    await api.delete(`/users/${row.id}`);
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Users</h2>
        {isSuperadmin && <button className="btn btn-primary" onClick={() => setCreating(!creating)}>+ New user</button>}
      </div>

      {!isSuperadmin && (
        <p className="hint-text">You can assign module access for modules you administer. Only the Superadmin can add, edit, or remove logins.</p>
      )}

      {creating && (
        <form className="record-form" onSubmit={handleCreate}>
          <label className="field"><span className="field-label">Name *</span>
            <input className="text-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field"><span className="field-label">Email (used as login username) *</span>
            <input className="text-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field"><span className="field-label">Job title</span>
            <input className="text-input" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></label>
          <label className="field"><span className="field-label">Role</span>
            <select className="text-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">User</option>
              <option value="module_admin">Module Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Create user</button>
            <button className="btn btn-ghost" type="button" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      )}

      <DataTable
        rows={users}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', render: (r) => r.role.replace('_', ' ') },
          { key: 'job_title', label: 'Title' },
          {
            key: 'modules', label: 'Module access', render: (row) => (
              <div className="module-chips">
                {MODULES.map((m) => {
                  const granted = row.module_access.some((a) => a.module === m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`chip ${granted ? 'chip-on' : 'chip-off'}`}
                      onClick={() => toggleModule(row.id, m, granted)}
                    >
                      {m.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            ),
          },
          ...(isSuperadmin ? [{ key: 'actions', label: '', render: (row) => (
            <button className="btn btn-link" onClick={() => handleDeactivate(row)}>Deactivate</button>
          ) }] : []),
        ]}
      />
    </div>
  );
}
