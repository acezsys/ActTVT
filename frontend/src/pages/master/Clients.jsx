import { useEffect, useState } from 'react';
import api from '../../lib/api';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

const BLANK = { client_name: '', contact_person: '', client_mobile: '', client_email: '', client_address: '', client_dispatch_address: '', client_gst: '' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null); // null = list view, {} = new, {..} = edit
  const [form, setForm] = useState(BLANK);
  const { user } = useAuth();
  const canEdit = user?.role === 'superadmin';

  async function load() {
    const { data } = await api.get('/clients');
    setClients(data);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setForm(BLANK); setEditing({}); }
  function startEdit(row) { setForm(row); setEditing(row); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editing.client_id) {
      await api.put(`/clients/${editing.client_id}`, form);
    } else {
      await api.post('/clients', form);
    }
    setEditing(null);
    load();
  }

  async function handleDeactivate(row) {
    if (!confirm(`Deactivate ${row.client_name}?`)) return;
    await api.delete(`/clients/${row.client_id}`);
    load();
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{editing.client_id ? 'Edit client' : 'New client'}</h2>
        <form className="record-form" onSubmit={handleSubmit}>
          <label className="field"><span className="field-label">Client name *</span>
            <input className="text-input" required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></label>
          <label className="field"><span className="field-label">Contact person</span>
            <input className="text-input" value={form.contact_person || ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></label>
          <label className="field"><span className="field-label">Mobile</span>
            <input className="text-input" value={form.client_mobile || ''} onChange={(e) => setForm({ ...form, client_mobile: e.target.value })} /></label>
          <label className="field"><span className="field-label">Email</span>
            <input className="text-input" type="email" value={form.client_email || ''} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></label>
          <label className="field"><span className="field-label">Address</span>
            <textarea className="text-input" value={form.client_address || ''} onChange={(e) => setForm({ ...form, client_address: e.target.value })} /></label>
          <label className="field"><span className="field-label">Dispatch address</span>
            <textarea className="text-input" value={form.client_dispatch_address || ''} onChange={(e) => setForm({ ...form, client_dispatch_address: e.target.value })} /></label>
          <label className="field"><span className="field-label">GSTIN</span>
            <input className="text-input" value={form.client_gst || ''} onChange={(e) => setForm({ ...form, client_gst: e.target.value })} /></label>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Save</button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Clients</h2>
        {canEdit && <button className="btn btn-primary" onClick={startNew}>+ New client</button>}
      </div>
      <DataTable
        rows={clients}
        onRowClick={canEdit ? startEdit : undefined}
        columns={[
          { key: 'client_id', label: 'ID' },
          { key: 'client_name', label: 'Name' },
          { key: 'contact_person', label: 'Contact' },
          { key: 'client_mobile', label: 'Mobile' },
          { key: 'client_email', label: 'Email' },
          { key: 'client_gst', label: 'GSTIN' },
          ...(canEdit ? [{ key: 'actions', label: '', render: (row) => (
            <button className="btn btn-link" onClick={(e) => { e.stopPropagation(); handleDeactivate(row); }}>Deactivate</button>
          ) }] : []),
        ]}
        emptyMessage="No clients yet. Add your first one."
      />
    </div>
  );
}
