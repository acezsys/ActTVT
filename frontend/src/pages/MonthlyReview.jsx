import { useEffect, useState } from 'react';
import api from '../lib/api';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const body = rows.map((r) => columns.map((c) => `"${(r[c.key] ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  return `${header}\n${body}`;
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MonthlyReview() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);

  async function load() {
    const { data } = await api.get('/management/monthly-review', { params: { month } });
    setData(data);
  }
  useEffect(() => { load(); }, [month]);

  function exportAll() {
    if (!data) return;
    const csv = toCsv(data.orders, [
      { key: 'work_order_id', label: 'Work Order' }, { key: 'item_description', label: 'Item' },
      { key: 'quantity', label: 'Qty' }, { key: 'value', label: 'Value' }, { key: 'status', label: 'Status' },
    ]);
    downloadCsv(`monthly-review-orders-${month}.csv`, csv);
  }

  if (!data) return <div className="page"><h2>Monthly Review</h2><p className="hint-text">Loading…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Monthly Review</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="text-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button className="btn btn-ghost" onClick={exportAll}>Export orders CSV</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.totals.orders_count}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Orders received</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>₹{data.totals.total_order_value.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total order value</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.totals.dispatches_count}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dispatches</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>₹{data.totals.total_invoiced.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total invoiced</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{data.totals.vendor_pos_count}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Vendor POs raised</div>
        </div>
      </div>

      <h3 style={{ fontSize: 14 }}>Orders this month</h3>
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table className="data-table">
          <thead><tr><th>Work Order</th><th>Item</th><th>Qty</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            {data.orders.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No orders this month.</td></tr>}
            {data.orders.map((o) => (
              <tr key={o.work_order_id}><td>{o.work_order_id}</td><td>{o.item_description}</td><td>{o.quantity}</td><td>₹{Number(o.value).toLocaleString('en-IN')}</td><td>{o.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 14 }}>Invoices this month</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Invoice</th><th>Work Order</th><th>Amount</th><th>Payment</th></tr></thead>
          <tbody>
            {data.invoices.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No invoices this month.</td></tr>}
            {data.invoices.map((i) => (
              <tr key={i.invoice_id}><td>{i.invoice_id}</td><td>{i.work_order_id}</td><td>₹{Number(i.total_amount).toLocaleString('en-IN')}</td><td>{i.payment_status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
