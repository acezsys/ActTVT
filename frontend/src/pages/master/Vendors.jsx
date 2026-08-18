import { useEffect, useState } from 'react';
import api from '../../lib/api';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

const BLANK = { vendor_name: '', contact_person: '', phone: '', email: '', gstin: '', address: '', category: '', rating: '' };

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const { user } = useAuth();
  const canEdit = user?.role === 'superadmin';

  async function load() {
    const { data } = await api.get('/vendors');
    setVendors(data);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setForm(BLANK); setEditing({}); }
  function startEdit(row) { setForm(row); setEditing(row); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editing.vendor_id) await api.put(`/vendors/${editing.vendor_id}`, form);
    else await api.post('/vendors', form);
    setEditing(null);
    load();
  }

  async function handleDeactivate(row) {
    if (!confirm(`Deactivate ${row.vendor_name}?`)) return;
    await api.delete(`/vendors/${row.vendor_id}`);
    load();
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{editing.vendor_id ? 'Edit vendor' : 'New vendor'}</h2>
        <form className="record-form" onSubmit={handleSubmit}>
          <label className="field"><span className="field-label">Vendor name *</span>
            <input className="text-input" required value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} /></label>
          <label className="field"><span className="field-label">Contact person</span>
            <input className="text-input" value={form.contact_person || ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></label>
          <label className="field"><span className="field-label">Phone</span>
            <input className="text-input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="field"><span className="field-label">Email</span>
            <input className="text-input" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field"><span className="field-label">GSTIN</span>
            <input className="text-input" value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></label>
          <label className="field"><span className="field-label">Address</span>
            <textarea className="text-input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label className="field"><span className="field-label">Category / items supplied</span>
            <input className="text-input" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label className="field"><span className="field-label">Rating (1-5)</span>
            <input className="text-input" type="number" min="1" max="5" value={form.rating || ''} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></label>

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
        <h2>Vendors</h2>
        {canEdit && <button className="btn btn-primary" onClick={startNew}>+ New vendor</button>}
      </div>
      <DataTable
        rows={vendors}
        onRowClick={canEdit ? startEdit : undefined}
        columns={[
          { key: 'vendor_id', label: 'ID' },
          { key: 'vendor_name', label: 'Name' },
          { key: 'category', label: 'Category' },
          { key: 'phone', label: 'Phone' },
          { key: 'rating', label: 'Rating', render: (r) => r.rating ? '★'.repeat(r.rating) : '—' },
          ...(canEdit ? [{ key: 'actions', label: '', render: (row) => (
            <button className="btn btn-link" onClick={(e) => { e.stopPropagation(); handleDeactivate(row); }}>Deactivate</button>
          ) }] : []),
        ]}
        emptyMessage="No vendors yet. Add your first one."
      />
    </div>
  );
}
