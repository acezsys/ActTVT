import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';

const ASSEMBLY_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', done: 'Done' };

export default function Production() {
  const [rows, setRows] = useState([]);
  const [filterAssembly, setFilterAssembly] = useState('');

  async function load() {
    const params = filterAssembly ? { assembly_status: filterAssembly } : {};
    const { data } = await api.get('/production', { params });
    setRows(data);
  }
  useEffect(() => { load(); }, [filterAssembly]);

  async function handleUpdate(row, updates) {
    await api.put(`/production/${row.work_order_id}`, { ...row, ...updates });
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Production</h2>
      </div>
      <p className="hint-text">A production row is created automatically for every Work Order — update Raw Material and Assembly status here as work progresses.</p>

      <div className="filter-row">
        <select className="text-input" value={filterAssembly} onChange={(e) => setFilterAssembly(e.target.value)}>
          <option value="">All assembly statuses</option>
          {Object.entries(ASSEMBLY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: 'work_order_id', label: 'Work Order' },
          { key: 'client_name', label: 'Client' },
          { key: 'item_description', label: 'Item' },
          { key: 'order_quantity', label: 'Order Qty' },
          {
            key: 'raw_material_required', label: 'RM Required', render: (r) => (
              <input className="text-input" style={{ width: 90 }} type="number" defaultValue={r.raw_material_required || ''}
                onBlur={(e) => handleUpdate(r, { raw_material_required: e.target.value })} />
            ),
          },
          {
            key: 'raw_material_available', label: 'RM Available', render: (r) => (
              <input className="text-input" style={{ width: 90 }} type="number" defaultValue={r.raw_material_available || ''}
                onBlur={(e) => handleUpdate(r, { raw_material_available: e.target.value })} />
            ),
          },
          { key: 'raw_material_to_order', label: 'RM To Order', render: (r) => (
              <strong style={{ color: Number(r.raw_material_to_order) > 0 ? 'var(--amber)' : 'var(--green)' }}>{r.raw_material_to_order ?? '—'}</strong>
            ) },
          {
            key: 'assembly_status', label: 'Assembly', render: (r) => (
              <select className="text-input" value={r.assembly_status} onChange={(e) => handleUpdate(r, { assembly_status: e.target.value })}>
                {Object.entries(ASSEMBLY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ),
          },
          {
            key: 'ready_for_inspection', label: 'Ready for Inspection', render: (r) => (
              <input type="checkbox" checked={r.ready_for_inspection} onChange={(e) => handleUpdate(r, { ready_for_inspection: e.target.checked })} />
            ),
          },
        ]}
        emptyMessage="No work orders yet — Production rows appear automatically once a Work Order is created."
      />
    </div>
  );
}
