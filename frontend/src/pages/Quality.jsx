import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import { formatDate } from '../lib/dateFormat';

const LAB_LABELS = { pending: 'Pending', pass: 'Pass', fail: 'Fail' };
const LAB_COLORS = { pending: 'var(--text-muted)', pass: 'var(--green)', fail: 'var(--red)' };

export default function Quality() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');

  async function load() {
    const params = filter ? { lab_result: filter } : {};
    const { data } = await api.get('/quality', { params });
    setRows(data);
  }
  useEffect(() => { load(); }, [filter]);

  async function handleUpdate(row, updates) {
    await api.put(`/quality/${row.id}`, { ...row, ...updates });
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Quality / Lab Tracking</h2>
      </div>
      <p className="hint-text">Lab results are entered against each Vendor PO line on receipt — this view collects them all in one place for quick review.</p>

      <div className="filter-row">
        <select className="text-input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All lab results</option>
          {Object.entries(LAB_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: 'vendor_po_id', label: 'PO Id' },
          { key: 'vendor_name', label: 'Vendor' },
          { key: 'part_description', label: 'Part' },
          { key: 'received_qty', label: 'Received Qty' },
          { key: 'stock_no', label: 'Stock No.' },
          { key: 'lab_name', label: 'Lab Name', render: (r) => (
              <input className="text-input" style={{ width: 120 }} defaultValue={r.lab_name || ''}
                onBlur={(e) => handleUpdate(r, { lab_name: e.target.value })} />
            ) },
          { key: 'lab_result', label: 'Result', render: (r) => (
              <select className="text-input" value={r.lab_result} onChange={(e) => handleUpdate(r, { lab_result: e.target.value })}
                style={{ color: LAB_COLORS[r.lab_result], fontWeight: 600 }}>
                {Object.entries(LAB_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) },
          { key: 'lab_report_no', label: 'Report No.', render: (r) => (
              <input className="text-input" style={{ width: 100 }} defaultValue={r.lab_report_no || ''}
                onBlur={(e) => handleUpdate(r, { lab_report_no: e.target.value })} />
            ) },
          { key: 'created_at', label: 'Logged', render: (r) => formatDate(r.created_at) },
        ]}
        emptyMessage="No lab results recorded yet — they appear here once entered against a Vendor PO receipt."
      />
    </div>
  );
}
