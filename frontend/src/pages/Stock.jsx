import { useEffect, useState } from 'react';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import DateField from '../components/DateField';
import { formatDate } from '../lib/dateFormat';

const BLANK_RECEIPT = { part_id: '', purchase_qty: '', unit: '', lab_report_no: '', transaction_date: '' };
const BLANK_ISSUE = { part_id: '', work_order_id: '', issued_qty: '', unit: '', transaction_date: '' };

export default function Stock() {
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [parts, setParts] = useState([]);
  const [view, setView] = useState('balance'); // 'balance' | 'receipt' | 'issue'
  const [receiptForm, setReceiptForm] = useState(BLANK_RECEIPT);
  const [issueForm, setIssueForm] = useState(BLANK_ISSUE);
  const [error, setError] = useState('');

  async function loadBalances() {
    const { data } = await api.get('/stock/balance');
    setBalances(data);
  }
  async function loadTransactions() {
    const { data } = await api.get('/stock');
    setTransactions(data);
  }
  useEffect(() => { loadBalances(); loadTransactions(); api.get('/parts').then(({ data }) => setParts(data)); }, []);

  async function handleReceipt(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/stock/receipts', receiptForm);
      setReceiptForm(BLANK_RECEIPT);
      setView('balance');
      loadBalances();
      loadTransactions();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    }
  }

  async function handleIssue(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/stock/issues', issueForm);
      setIssueForm(BLANK_ISSUE);
      setView('balance');
      loadBalances();
      loadTransactions();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    }
  }

  if (view === 'receipt') {
    return (
      <div className="page">
        <h2>Record stock receipt</h2>
        <form className="record-form" onSubmit={handleReceipt}>
          <label className="field"><span className="field-label">Part *</span>
            <select className="text-input" required value={receiptForm.part_id} onChange={(e) => setReceiptForm({ ...receiptForm, part_id: e.target.value })}>
              <option value="">Select part…</option>
              {parts.map((p) => <option key={p.part_id} value={p.part_id}>{p.description}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Quantity received *</span>
            <input className="text-input" type="number" step="0.001" required value={receiptForm.purchase_qty} onChange={(e) => setReceiptForm({ ...receiptForm, purchase_qty: e.target.value })} /></label>
          <label className="field"><span className="field-label">Unit</span>
            <input className="text-input" placeholder="Nos / Kg / Mtrs" value={receiptForm.unit} onChange={(e) => setReceiptForm({ ...receiptForm, unit: e.target.value })} /></label>
          <label className="field"><span className="field-label">Lab Report No. (if applicable)</span>
            <input className="text-input" value={receiptForm.lab_report_no} onChange={(e) => setReceiptForm({ ...receiptForm, lab_report_no: e.target.value })} /></label>
          <DateField label="Transaction date" value={receiptForm.transaction_date} onChange={(v) => setReceiptForm({ ...receiptForm, transaction_date: v })} />
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Record receipt</button>
            <button className="btn btn-ghost" type="button" onClick={() => setView('balance')}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'issue') {
    return (
      <div className="page">
        <h2>Issue stock to a Work Order</h2>
        <form className="record-form" onSubmit={handleIssue}>
          <label className="field"><span className="field-label">Part *</span>
            <select className="text-input" required value={issueForm.part_id} onChange={(e) => setIssueForm({ ...issueForm, part_id: e.target.value })}>
              <option value="">Select part…</option>
              {parts.map((p) => <option key={p.part_id} value={p.part_id}>{p.description}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Work Order Id *</span>
            <input className="text-input" required value={issueForm.work_order_id} onChange={(e) => setIssueForm({ ...issueForm, work_order_id: e.target.value })} placeholder="SO-0000" /></label>
          <label className="field"><span className="field-label">Quantity to issue *</span>
            <input className="text-input" type="number" step="0.001" required value={issueForm.issued_qty} onChange={(e) => setIssueForm({ ...issueForm, issued_qty: e.target.value })} /></label>
          <label className="field"><span className="field-label">Unit</span>
            <input className="text-input" value={issueForm.unit} onChange={(e) => setIssueForm({ ...issueForm, unit: e.target.value })} /></label>
          <DateField label="Transaction date" value={issueForm.transaction_date} onChange={(v) => setIssueForm({ ...issueForm, transaction_date: v })} />
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Issue stock</button>
            <button className="btn btn-ghost" type="button" onClick={() => setView('balance')}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Stores / Inventory</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setView('issue')}>Issue to Work Order</button>
          <button className="btn btn-primary" onClick={() => setView('receipt')}>+ Record receipt</button>
        </div>
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Current balances</h3>
      <DataTable
        rows={balances}
        columns={[
          { key: 'part_id', label: 'Part Id' },
          { key: 'description', label: 'Description' },
          { key: 'total_purchased', label: 'Total Purchased' },
          { key: 'total_issued', label: 'Total Issued' },
          { key: 'net_balance', label: 'Net Balance', render: (r) => (
              <strong style={{ color: Number(r.net_balance) <= 0 ? 'var(--red)' : 'var(--text)' }}>{r.net_balance} {r.unit || ''}</strong>
            ) },
        ]}
        emptyMessage="No parts with stock activity yet."
      />

      <h3 style={{ fontSize: 15, margin: '28px 0 10px' }}>Recent transactions</h3>
      <DataTable
        rows={transactions.slice(0, 30)}
        columns={[
          { key: 'transaction_date', label: 'Date', render: (r) => formatDate(r.transaction_date) },
          { key: 'part_description', label: 'Part' },
          { key: 'purchase_qty', label: 'Purchased', render: (r) => Number(r.purchase_qty) > 0 ? `+${r.purchase_qty}` : '—' },
          { key: 'issued_qty', label: 'Issued', render: (r) => Number(r.issued_qty) > 0 ? `-${r.issued_qty}` : '—' },
          { key: 'work_order_id', label: 'Work Order', render: (r) => r.work_order_id || '—' },
          { key: 'lab_report_no', label: 'Lab Report', render: (r) => r.lab_report_no || '—' },
        ]}
        emptyMessage="No transactions yet."
      />
    </div>
  );
}
