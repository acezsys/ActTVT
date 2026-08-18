import { useEffect, useState } from 'react';
import api from '../../lib/api';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

const BLANK = { description: '', hsn_code: '', unit: '', drawing_ref: '' };

export default function Parts() {
  const [parts, setParts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const { user } = useAuth();
  const canEdit = user?.role === 'superadmin';

  async function load() {
    const { data } = await api.get('/parts');
    setParts(data);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setForm(BLANK); setEditing({}); }
  function startEdit(row) { setForm(row); setEditing(row); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editing.part_id) await api.put(`/parts/${editing.part_id}`, form);
    else await api.post('/parts', form);
    setEditing(null);
    load();
  }

  async function handleDeactivate(row) {
    if (!confirm(`Deactivate ${row.description}?`)) return;
    await api.delete(`/parts/${row.part_id}`);
    load();
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{editing.part_id ? 'Edit part' : 'New part'}</h2>
        <form className="record-form" onSubmit={handleSubmit}>
          <label className="field"><span className="field-label">Description *</span>
            <input className="text-input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="field"><span className="field-label">HSN/SAC code</span>
            <input className="text-input" value={form.hsn_code || ''} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} /></label>
          <label className="field"><span className="field-label">Unit (Nos / Kg / Mtrs)</span>
            <input className="text-input" value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
          <label className="field"><span className="field-label">Drawing reference</span>
            <input className="text-input" value={form.drawing_ref || ''} onChange={(e) => setForm({ ...form, drawing_ref: e.target.value })} /></label>

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
        <h2>Parts</h2>
        {canEdit && <button className="btn btn-primary" onClick={startNew}>+ New part</button>}
      </div>
      <DataTable
        rows={parts}
        onRowClick={canEdit ? startEdit : undefined}
        columns={[
          { key: 'part_id', label: 'ID' },
          { key: 'description', label: 'Description' },
          { key: 'hsn_code', label: 'HSN/SAC' },
          { key: 'unit', label: 'Unit' },
          { key: 'drawing_ref', label: 'Drawing ref.' },
          ...(canEdit ? [{ key: 'actions', label: '', render: (row) => (
            <button className="btn btn-link" onClick={(e) => { e.stopPropagation(); handleDeactivate(row); }}>Deactivate</button>
          ) }] : []),
        ]}
        emptyMessage="No parts yet. Add your first one."
      />
    </div>
  );
}
