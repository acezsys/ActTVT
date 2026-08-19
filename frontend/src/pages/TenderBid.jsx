import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import DateField from '../components/DateField';
import { formatDate } from '../lib/dateFormat';

const BLANK = { item_description: '', quantity: '', bid_submission_due: '', bid_status: 'not_quoted', result: 'pending', po_id: '', tender_id: '', notes: '' };

const BID_STATUS_LABELS = { quoted: 'Quoted', not_quoted: 'Not Quoted' };
const RESULT_LABELS = { won: 'Won', lost: 'Lost', pending: 'Pending' };

export default function TenderBid() {
  const [bids, setBids] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterResult, setFilterResult] = useState('');

  async function load() {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterResult) params.result = filterResult;
    const { data } = await api.get('/tenders', { params });
    setBids(data);
  }
  useEffect(() => { load(); }, [filterStatus, filterResult]);

  function startNew() { setForm(BLANK); setEditing({}); }
  function startEdit(row) { setForm(row); setEditing(row); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editing.order_id) await api.put(`/tenders/${editing.order_id}`, form);
    else await api.post('/tenders', form);
    setEditing(null);
    load();
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{editing.order_id ? `Edit ${editing.order_id}` : 'New Order / Tender entry'}</h2>
        <form className="record-form" onSubmit={handleSubmit}>
          <label className="field"><span className="field-label">Item description *</span>
            <input className="text-input" required value={form.item_description} onChange={(e) => setForm({ ...form, item_description: e.target.value })} /></label>
          <label className="field"><span className="field-label">Quantity *</span>
            <input className="text-input" type="number" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>

          <DateField label="Bid Submission Due Date *" value={form.bid_submission_due} onChange={(v) => setForm({ ...form, bid_submission_due: v })} required />

          <label className="field"><span className="field-label">Bid status</span>
            <select className="text-input" value={form.bid_status} onChange={(e) => setForm({ ...form, bid_status: e.target.value })}>
              <option value="not_quoted">Not Quoted</option>
              <option value="quoted">Quoted</option>
            </select>
          </label>

          <label className="field"><span className="field-label">Result</span>
            <select className="text-input" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </label>

          {form.result === 'won' && (
            <label className="field"><span className="field-label">PO Id</span>
              <input className="text-input" value={form.po_id || ''} onChange={(e) => setForm({ ...form, po_id: e.target.value })} placeholder="Fill in once the PO is received" /></label>
          )}

          <label className="field"><span className="field-label">Tender Id (GeM / govt reference — leave blank for direct orders)</span>
            <input className="text-input" value={form.tender_id || ''} onChange={(e) => setForm({ ...form, tender_id: e.target.value })} /></label>

          <label className="field"><span className="field-label">Notes</span>
            <textarea className="text-input" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>

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
        <h2>Tender / Bid Tracking</h2>
        <button className="btn btn-primary" onClick={startNew}>+ New entry</button>
      </div>

      <div className="filter-row">
        <select className="text-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All bid statuses</option>
          <option value="quoted">Quoted</option>
          <option value="not_quoted">Not Quoted</option>
        </select>
        <select className="text-input" value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
          <option value="">All results</option>
          <option value="pending">Pending</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      <DataTable
        rows={bids}
        onRowClick={startEdit}
        columns={[
          { key: 'order_id', label: 'Order ID' },
          { key: 'item_description', label: 'Item' },
          { key: 'quantity', label: 'Qty' },
          { key: 'bid_submission_due', label: 'Bid Due', render: (r) => {
              const d = daysUntil(r.bid_submission_due);
              const overdue = d !== null && d < 0 && r.result === 'pending';
              return <span style={overdue ? { color: 'var(--red)', fontWeight: 600 } : undefined}>{formatDate(r.bid_submission_due)}</span>;
            } },
          { key: 'bid_status', label: 'Bid Status', render: (r) => BID_STATUS_LABELS[r.bid_status] },
          { key: 'result', label: 'Result', render: (r) => RESULT_LABELS[r.result] },
          { key: 'po_id', label: 'PO Id', render: (r) => r.po_id || '—' },
          { key: 'tender_id', label: 'Tender Id', render: (r) => r.tender_id || '(direct order)' },
        ]}
        emptyMessage="No tender/bid entries yet."
      />
    </div>
  );
}
