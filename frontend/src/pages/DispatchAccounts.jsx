import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import DateField from '../components/DateField';
import { formatDate } from '../lib/dateFormat';

const PAYMENT_LABELS = { paid: 'Paid', partially_paid: 'Partially Paid', unpaid: 'Unpaid', overdue: 'Overdue' };
const PAYMENT_COLORS = { paid: 'var(--green)', partially_paid: 'var(--amber)', unpaid: 'var(--text-muted)', overdue: 'var(--red)' };

const BLANK_DISPATCH = { work_order_id: '', dispatch_date: '', challan_no: '', dispatched_qty: '', dispatched_through: '', destination: '' };
const BLANK_LINE = { description: '', drawing_ref: '', hsn_sac: '', gst_rate: 18, quantity: '', rate: '', unit: 'Nos', discount_pct: 0, line_kind: 'item' };
const BLANK_INVOICE = { work_order_id: '', buyers_order_no: '', buyers_order_date: '', due_date: '' };

export default function DispatchAccounts() {
  const [tab, setTab] = useState('invoices'); // 'invoices' | 'dispatches'
  const [invoices, setInvoices] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [creatingDispatch, setCreatingDispatch] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [dispatchForm, setDispatchForm] = useState(BLANK_DISPATCH);
  const [invoiceForm, setInvoiceForm] = useState(BLANK_INVOICE);
  const [invoiceLines, setInvoiceLines] = useState([{ ...BLANK_LINE }]);
  const [filterPayment, setFilterPayment] = useState('');

  async function loadInvoices() {
    const params = filterPayment ? { payment_status: filterPayment } : {};
    const { data } = await api.get('/dispatch-accounts/invoices', { params });
    setInvoices(data);
  }
  async function loadDispatches() {
    const { data } = await api.get('/dispatch-accounts/dispatches');
    setDispatches(data);
  }
  useEffect(() => { loadInvoices(); }, [filterPayment]);
  useEffect(() => { loadDispatches(); }, []);

  async function handleCreateDispatch(e) {
    e.preventDefault();
    await api.post('/dispatch-accounts/dispatches', dispatchForm);
    setDispatchForm(BLANK_DISPATCH);
    setCreatingDispatch(false);
    loadDispatches();
  }

  function updateLine(i, field, value) {
    const next = [...invoiceLines];
    next[i] = { ...next[i], [field]: value };
    setInvoiceLines(next);
  }
  function addLine(kind = 'item') {
    setInvoiceLines([...invoiceLines, { ...BLANK_LINE, line_kind: kind, description: kind === 'item' ? '' : kind[0].toUpperCase() + kind.slice(1) + ' Charges' }]);
  }
  function removeLine(i) {
    setInvoiceLines(invoiceLines.filter((_, idx) => idx !== i));
  }

  async function handleCreateInvoice(e) {
    e.preventDefault();
    await api.post('/dispatch-accounts/invoices', { ...invoiceForm, lines: invoiceLines });
    setInvoiceForm(BLANK_INVOICE);
    setInvoiceLines([{ ...BLANK_LINE }]);
    setCreatingInvoice(false);
    loadInvoices();
  }

  async function handlePaymentUpdate(inv, updates) {
    await api.put(`/dispatch-accounts/invoices/${inv.invoice_id}/payment`, { payment_status: inv.payment_status, amount_paid: inv.amount_paid, ...updates });
    loadInvoices();
  }

  async function downloadPdf(invoiceId) {
    const response = await api.get(`/dispatch-accounts/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  }

  // --- Create dispatch form ------------------------------------------------
  if (creatingDispatch) {
    return (
      <div className="page">
        <h2>Record dispatch</h2>
        <form className="record-form" onSubmit={handleCreateDispatch}>
          <label className="field"><span className="field-label">Work Order Id *</span>
            <input className="text-input" required value={dispatchForm.work_order_id} onChange={(e) => setDispatchForm({ ...dispatchForm, work_order_id: e.target.value })} placeholder="SO-0000" /></label>
          <DateField label="Dispatch date *" value={dispatchForm.dispatch_date} onChange={(v) => setDispatchForm({ ...dispatchForm, dispatch_date: v })} required />
          <label className="field"><span className="field-label">Challan No.</span>
            <input className="text-input" value={dispatchForm.challan_no} onChange={(e) => setDispatchForm({ ...dispatchForm, challan_no: e.target.value })} /></label>
          <label className="field"><span className="field-label">Dispatched quantity *</span>
            <input className="text-input" type="number" required value={dispatchForm.dispatched_qty} onChange={(e) => setDispatchForm({ ...dispatchForm, dispatched_qty: e.target.value })} /></label>
          <label className="field"><span className="field-label">Dispatched through</span>
            <input className="text-input" value={dispatchForm.dispatched_through} onChange={(e) => setDispatchForm({ ...dispatchForm, dispatched_through: e.target.value })} /></label>
          <label className="field"><span className="field-label">Destination</span>
            <input className="text-input" value={dispatchForm.destination} onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })} /></label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Record dispatch</button>
            <button className="btn btn-ghost" type="button" onClick={() => setCreatingDispatch(false)}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  // --- Create invoice form ---------------------------------------------------
  if (creatingInvoice) {
    return (
      <div className="page">
        <h2>New Invoice</h2>
        <form className="record-form" onSubmit={handleCreateInvoice} style={{ maxWidth: 700 }}>
          <label className="field"><span className="field-label">Work Order Id *</span>
            <input className="text-input" required value={invoiceForm.work_order_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, work_order_id: e.target.value })} placeholder="SO-0000" /></label>
          <label className="field"><span className="field-label">Buyer's Order No. (PO No.)</span>
            <input className="text-input" value={invoiceForm.buyers_order_no} onChange={(e) => setInvoiceForm({ ...invoiceForm, buyers_order_no: e.target.value })} /></label>
          <DateField label="Buyer's Order Date" value={invoiceForm.buyers_order_date} onChange={(v) => setInvoiceForm({ ...invoiceForm, buyers_order_date: v })} />
          <DateField label="Payment due date" value={invoiceForm.due_date} onChange={(v) => setInvoiceForm({ ...invoiceForm, due_date: v })} />

          <h3 style={{ fontSize: 14, marginTop: 10 }}>Line items</h3>
          {invoiceLines.map((line, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                <input className="text-input" placeholder="Description" value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} required />
                <input className="text-input" placeholder="Drawing ref (optional)" value={line.drawing_ref} onChange={(e) => updateLine(i, 'drawing_ref', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                <input className="text-input" placeholder="HSN/SAC" value={line.hsn_sac} onChange={(e) => updateLine(i, 'hsn_sac', e.target.value)} />
                <input className="text-input" type="number" placeholder="GST%" value={line.gst_rate} onChange={(e) => updateLine(i, 'gst_rate', e.target.value)} />
                <input className="text-input" type="number" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                <input className="text-input" type="number" placeholder="Rate" value={line.rate} onChange={(e) => updateLine(i, 'rate', e.target.value)} required />
                <input className="text-input" placeholder="Unit" value={line.unit} onChange={(e) => updateLine(i, 'unit', e.target.value)} />
                <button className="btn btn-link" type="button" onClick={() => removeLine(i)}>Remove</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-ghost" type="button" onClick={() => addLine('item')}>+ Item line</button>
            <button className="btn btn-ghost" type="button" onClick={() => addLine('packing')}>+ Packing charge</button>
            <button className="btn btn-ghost" type="button" onClick={() => addLine('forwarding')}>+ Forwarding charge</button>
            <button className="btn btn-ghost" type="button" onClick={() => addLine('freight')}>+ Freight charge</button>
          </div>

          <p className="hint-text">Tax type (IGST vs CGST+SGST) is applied automatically based on the client's GST state vs. Arieckal Industries' home state (Maharashtra).</p>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Create invoice</button>
            <button className="btn btn-ghost" type="button" onClick={() => setCreatingInvoice(false)}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  // --- Main view: tabs -----------------------------------------------------
  return (
    <div className="page">
      <div className="page-header">
        <h2>Dispatch / Accounts</h2>
        {tab === 'invoices'
          ? <button className="btn btn-primary" onClick={() => setCreatingInvoice(true)}>+ New Invoice</button>
          : <button className="btn btn-primary" onClick={() => setCreatingDispatch(true)}>+ Record Dispatch</button>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button className={`btn ${tab === 'invoices' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('invoices')}>Invoices</button>
        <button className={`btn ${tab === 'dispatches' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('dispatches')}>Dispatches</button>
      </div>

      {tab === 'invoices' && (
        <>
          <div className="filter-row">
            <select className="text-input" value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
              <option value="">All payment statuses</option>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <DataTable
            rows={invoices}
            columns={[
              { key: 'invoice_id', label: 'Invoice Id' },
              { key: 'client_name', label: 'Client' },
              { key: 'work_order_id', label: 'Work Order' },
              { key: 'invoice_date', label: 'Date', render: (r) => formatDate(r.invoice_date) },
              { key: 'total_amount', label: 'Total', render: (r) => `₹${Number(r.total_amount).toLocaleString('en-IN')}` },
              { key: 'payment_status', label: 'Payment', render: (r) => (
                  <select className="text-input" value={r.payment_status} onChange={(e) => handlePaymentUpdate(r, { payment_status: e.target.value })}
                    style={{ color: PAYMENT_COLORS[r.payment_status], fontWeight: 600 }}>
                    {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                ) },
              { key: 'pdf', label: '', render: (r) => <button className="btn btn-link" onClick={() => downloadPdf(r.invoice_id)}>View PDF</button> },
            ]}
            emptyMessage="No invoices yet."
          />
        </>
      )}

      {tab === 'dispatches' && (
        <DataTable
          rows={dispatches}
          columns={[
            { key: 'work_order_id', label: 'Work Order' },
            { key: 'item_description', label: 'Item' },
            { key: 'dispatch_date', label: 'Date', render: (r) => formatDate(r.dispatch_date) },
            { key: 'challan_no', label: 'Challan No.' },
            { key: 'dispatched_qty', label: 'Qty Dispatched' },
            { key: 'destination', label: 'Destination' },
          ]}
          emptyMessage="No dispatches yet."
        />
      )}
    </div>
  );
}
