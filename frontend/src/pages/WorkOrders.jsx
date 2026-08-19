import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import DateField from '../components/DateField';
import { formatDate } from '../lib/dateFormat';

const BLANK = {
  po_id: '', client_id: '', item_description: '', quantity: '', rate: '',
  delivery_period_days: '', promised_delivery_date: '', bill_no: '',
  deduction_tds: '', deduction_ld: '', deduction_sd: '', deduction_misc: '', remarks: '',
};

const STATUS_LABELS = { draft: 'Draft', received: 'Received', processing: 'Processing', partially_dispatched: 'Partially Dispatched', completed: 'Completed', closed: 'Closed' };
const PAYMENT_LABELS = { paid: 'Paid', partially_paid: 'Partially Paid', unpaid: 'Unpaid', overdue: 'Overdue' };
const PAYMENT_COLORS = { paid: 'var(--green)', partially_paid: 'var(--amber)', unpaid: 'var(--text-muted)', overdue: 'var(--red)' };

export default function WorkOrders() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [wonBids, setWonBids] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');

  async function load() {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterPayment) params.payment_status = filterPayment;
    const { data } = await api.get('/work-orders', { params });
    setOrders(data);
  }
  useEffect(() => { load(); }, [filterStatus, filterPayment]);

  async function startNew() {
    setForm(BLANK);
    const [{ data: clientsData }, { data: bids }] = await Promise.all([
      api.get('/clients'),
      api.get('/work-orders/available-won-bids/list'),
    ]);
    setClients(clientsData);
    setWonBids(bids);
    setEditing({});
  }

  async function startEdit(row) {
    setForm(row);
    const { data: clientsData } = await api.get('/clients');
    setClients(clientsData);
    setEditing(row);
  }

  function applyBid(orderId) {
    const bid = wonBids.find((b) => b.order_id === orderId);
    if (bid) setForm({ ...form, po_id: bid.po_id, item_description: bid.item_description, quantity: bid.quantity });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editing.work_order_id) await api.put(`/work-orders/${editing.work_order_id}`, form);
    else await api.post('/work-orders', form);
    setEditing(null);
    load();
  }

  if (editing) {
    return (
      <div className="page">
        <h2>{editing.work_order_id ? `Edit ${editing.work_order_id}` : 'New Work Order'}</h2>
        <form className="record-form" onSubmit={handleSubmit}>
          {!editing.work_order_id && wonBids.length > 0 && (
            <label className="field"><span className="field-label">Create from a Won bid (optional)</span>
              <select className="text-input" onChange={(e) => applyBid(e.target.value)} defaultValue="">
                <option value="">— Start blank —</option>
                {wonBids.map((b) => <option key={b.order_id} value={b.order_id}>{b.order_id} — {b.item_description} (PO {b.po_id})</option>)}
              </select>
            </label>
          )}

          <label className="field"><span className="field-label">Client *</span>
            <select className="text-input" required value={form.client_id || ''} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
            </select>
          </label>

          <label className="field"><span className="field-label">PO Id</span>
            <input className="text-input" value={form.po_id || ''} onChange={(e) => setForm({ ...form, po_id: e.target.value })} /></label>

          <label className="field"><span className="field-label">Item description *</span>
            <input className="text-input" required value={form.item_description} onChange={(e) => setForm({ ...form, item_description: e.target.value })} /></label>

          <label className="field"><span className="field-label">Quantity *</span>
            <input className="text-input" type="number" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>

          <label className="field"><span className="field-label">Rate *</span>
            <input className="text-input" type="number" step="0.01" required value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></label>

          <label className="field"><span className="field-label">Delivery Period (days)</span>
            <input className="text-input" type="number" value={form.delivery_period_days || ''} onChange={(e) => setForm({ ...form, delivery_period_days: e.target.value })} /></label>

          <DateField label="Promised delivery date" value={form.promised_delivery_date} onChange={(v) => setForm({ ...form, promised_delivery_date: v })} />

          {editing.work_order_id && (
            <>
              <DateField label="Actual delivery date" value={form.actual_delivery_date} onChange={(v) => setForm({ ...form, actual_delivery_date: v })} />
              <label className="field"><span className="field-label">Bill No.</span>
                <input className="text-input" value={form.bill_no || ''} onChange={(e) => setForm({ ...form, bill_no: e.target.value })} /></label>
              <label className="field"><span className="field-label">Payment status</span>
                <select className="text-input" value={form.payment_status || 'unpaid'} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                  {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="field"><span className="field-label">Status</span>
                <select className="text-input" value={form.status || 'received'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <div className="field">
                <span className="field-label">Deductions</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input className="text-input" type="number" placeholder="TDS" value={form.deduction_tds || ''} onChange={(e) => setForm({ ...form, deduction_tds: e.target.value })} />
                  <input className="text-input" type="number" placeholder="LD" value={form.deduction_ld || ''} onChange={(e) => setForm({ ...form, deduction_ld: e.target.value })} />
                  <input className="text-input" type="number" placeholder="SD" value={form.deduction_sd || ''} onChange={(e) => setForm({ ...form, deduction_sd: e.target.value })} />
                  <input className="text-input" type="number" placeholder="Misc" value={form.deduction_misc || ''} onChange={(e) => setForm({ ...form, deduction_misc: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <label className="field"><span className="field-label">Remarks</span>
            <textarea className="text-input" value={form.remarks || ''} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>

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
        <h2>Sales / Work Orders</h2>
        <button className="btn btn-primary" onClick={startNew}>+ New Work Order</button>
      </div>

      <div className="filter-row">
        <select className="text-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="text-input" value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
          <option value="">All payment statuses</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <DataTable
        rows={orders}
        onRowClick={startEdit}
        columns={[
          { key: 'work_order_id', label: 'Work Order' },
          { key: 'client_name', label: 'Client' },
          { key: 'item_description', label: 'Item' },
          { key: 'value', label: 'Value', render: (r) => `₹${Number(r.value).toLocaleString('en-IN')}` },
          { key: 'promised_delivery_date', label: 'Promised Delivery', render: (r) => formatDate(r.promised_delivery_date) },
          { key: 'status', label: 'Status', render: (r) => STATUS_LABELS[r.status] },
          { key: 'payment_status', label: 'Payment', render: (r) => (
              <span style={{ color: PAYMENT_COLORS[r.payment_status], fontWeight: 600 }}>{PAYMENT_LABELS[r.payment_status]}</span>
            ) },
        ]}
        emptyMessage="No work orders yet."
      />
    </div>
  );
}
