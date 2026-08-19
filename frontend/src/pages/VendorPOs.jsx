import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import DateField from '../components/DateField';

const STATUS_LABELS = { draft: 'Draft', issued: 'Issued', partially_received: 'Partially Received', received: 'Received', closed: 'Closed' };
const LAB_LABELS = { pending: 'Pending', pass: 'Pass', fail: 'Fail' };
const LAB_COLORS = { pending: 'var(--text-muted)', pass: 'var(--green)', fail: 'var(--red)' };
const LINE_TYPE_LABELS = { original: 'Original', rework: 'Rework', replacement: 'Replacement' };

const BLANK_PO = { vendor_id: '', work_order_id: '', enquiry_ref: '', quotation_ref: '', delivery_period_days: '', promised_delivery_date: '', remarks: '' };
const BLANK_LINE = { part_id: '', quantity: '', rate: '', remarks: '' };

export default function VendorPOs() {
  const [pos, setPOs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [parts, setParts] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK_PO);
  const [detail, setDetail] = useState(null); // full PO + lines, when viewing one
  const [lineForm, setLineForm] = useState(BLANK_LINE);
  const [filterStatus, setFilterStatus] = useState('');

  async function load() {
    const params = filterStatus ? { status: filterStatus } : {};
    const { data } = await api.get('/vendor-pos', { params });
    setPOs(data);
  }
  useEffect(() => { load(); }, [filterStatus]);

  async function startCreate() {
    setForm(BLANK_PO);
    const [{ data: v }, { data: p }] = await Promise.all([api.get('/vendors'), api.get('/parts')]);
    setVendors(v);
    setParts(p);
    setCreating(true);
  }

  async function openDetail(row) {
    const { data } = await api.get(`/vendor-pos/${row.vendor_po_id}`);
    if (!parts.length) {
      const { data: p } = await api.get('/parts');
      setParts(p);
    }
    setDetail(data);
    setLineForm(BLANK_LINE);
  }

  async function handleCreatePO(e) {
    e.preventDefault();
    const { data } = await api.post('/vendor-pos', form);
    setCreating(false);
    load();
    openDetail(data);
  }

  async function handleAddLine(e) {
    e.preventDefault();
    await api.post(`/vendor-pos/${detail.vendor_po_id}/lines`, lineForm);
    setLineForm(BLANK_LINE);
    openDetail({ vendor_po_id: detail.vendor_po_id });
  }

  async function handleLineUpdate(line, updates) {
    await api.put(`/vendor-pos/${detail.vendor_po_id}/lines/${line.id}`, { ...line, ...updates });
    openDetail({ vendor_po_id: detail.vendor_po_id });
  }

  async function handleReject(line) {
    const type = prompt("Type 'rework' or 'replacement':", 'replacement');
    if (!type || !['rework', 'replacement'].includes(type)) return;
    await api.post(`/vendor-pos/${detail.vendor_po_id}/lines/${line.id}/reject`, { line_type: type, quantity: line.quantity });
    openDetail({ vendor_po_id: detail.vendor_po_id });
  }

  // --- Detail view: one PO with its lines --------------------------------
  if (detail) {
    return (
      <div className="page">
        <button className="btn btn-ghost" onClick={() => setDetail(null)} style={{ marginBottom: 16 }}>← Back to Vendor POs</button>
        <h2>{detail.vendor_po_id} — {detail.vendor_name}</h2>
        <p className="hint-text">Status: {STATUS_LABELS[detail.status]} · Vendor payment: {detail.vendor_payment_status}</p>

        <div className="table-wrap" style={{ marginBottom: 20 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th><th>Part</th><th>Qty</th><th>Received</th><th>Stock No.</th>
                <th>Lab Result</th><th>Lab Report No.</th><th></th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => (
                <tr key={line.id}>
                  <td>{LINE_TYPE_LABELS[line.line_type]}</td>
                  <td>{line.part_description || '—'}</td>
                  <td>{line.quantity}</td>
                  <td>
                    <input className="text-input" style={{ width: 80 }} type="number" defaultValue={line.received_qty || 0}
                      onBlur={(e) => handleLineUpdate(line, { received_qty: e.target.value })} />
                  </td>
                  <td>
                    <input className="text-input" style={{ width: 100 }} defaultValue={line.stock_no || ''}
                      onBlur={(e) => handleLineUpdate(line, { stock_no: e.target.value })} placeholder="PN-0000" />
                  </td>
                  <td>
                    <select className="text-input" value={line.lab_result} onChange={(e) => handleLineUpdate(line, { lab_result: e.target.value })}>
                      {Object.entries(LAB_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="text-input" style={{ width: 100 }} defaultValue={line.lab_report_no || ''}
                      onBlur={(e) => handleLineUpdate(line, { lab_report_no: e.target.value })} />
                  </td>
                  <td>
                    {line.lab_result === 'fail' && !line.original_line_id && (
                      <button className="btn btn-link" onClick={() => handleReject(line)}>Rework/Replace</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 15 }}>Add a line item</h3>
        <form className="record-form" onSubmit={handleAddLine} style={{ maxWidth: 400 }}>
          <label className="field"><span className="field-label">Part</span>
            <select className="text-input" value={lineForm.part_id} onChange={(e) => setLineForm({ ...lineForm, part_id: e.target.value })}>
              <option value="">Select part…</option>
              {parts.map((p) => <option key={p.part_id} value={p.part_id}>{p.description}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Quantity *</span>
            <input className="text-input" type="number" required value={lineForm.quantity} onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })} /></label>
          <label className="field"><span className="field-label">Rate</span>
            <input className="text-input" type="number" value={lineForm.rate} onChange={(e) => setLineForm({ ...lineForm, rate: e.target.value })} /></label>
          <button className="btn btn-primary" type="submit">Add line</button>
        </form>
      </div>
    );
  }

  // --- Create PO form ------------------------------------------------------
  if (creating) {
    return (
      <div className="page">
        <h2>New Vendor PO</h2>
        <form className="record-form" onSubmit={handleCreatePO}>
          <label className="field"><span className="field-label">Vendor *</span>
            <select className="text-input" required value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
              <option value="">Select vendor…</option>
              {vendors.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Linked Work Order Id (optional)</span>
            <input className="text-input" value={form.work_order_id} onChange={(e) => setForm({ ...form, work_order_id: e.target.value })} placeholder="SO-0000" /></label>
          <label className="field"><span className="field-label">Enquiry reference (optional — some vendors skip this)</span>
            <input className="text-input" value={form.enquiry_ref} onChange={(e) => setForm({ ...form, enquiry_ref: e.target.value })} /></label>
          <label className="field"><span className="field-label">Quotation reference (optional)</span>
            <input className="text-input" value={form.quotation_ref} onChange={(e) => setForm({ ...form, quotation_ref: e.target.value })} /></label>
          <label className="field"><span className="field-label">Delivery period (days)</span>
            <input className="text-input" type="number" value={form.delivery_period_days} onChange={(e) => setForm({ ...form, delivery_period_days: e.target.value })} /></label>
          <DateField label="Promised delivery date" value={form.promised_delivery_date} onChange={(v) => setForm({ ...form, promised_delivery_date: v })} />
          <label className="field"><span className="field-label">Remarks</span>
            <textarea className="text-input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Create PO</button>
            <button className="btn btn-ghost" type="button" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  // --- List view ------------------------------------------------------------
  return (
    <div className="page">
      <div className="page-header">
        <h2>Purchase / Vendor POs</h2>
        <button className="btn btn-primary" onClick={startCreate}>+ New Vendor PO</button>
      </div>

      <div className="filter-row">
        <select className="text-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <DataTable
        rows={pos}
        onRowClick={openDetail}
        columns={[
          { key: 'vendor_po_id', label: 'PO Id' },
          { key: 'vendor_name', label: 'Vendor' },
          { key: 'work_order_id', label: 'Work Order' },
          { key: 'status', label: 'Status', render: (r) => STATUS_LABELS[r.status] },
          { key: 'vendor_payment_status', label: 'Vendor Payment' },
        ]}
        emptyMessage="No vendor POs yet."
      />
    </div>
  );
}
