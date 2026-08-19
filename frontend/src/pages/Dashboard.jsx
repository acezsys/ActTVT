import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/dateFormat';

const STATUS_LABELS = { draft: 'Draft', received: 'Received', processing: 'Processing', partially_dispatched: 'Partially Dispatched', completed: 'Completed', closed: 'Closed' };

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px', minWidth: 140 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user, hasModule } = useAuth();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (hasModule('management')) {
      api.get('/management/summary').then(({ data }) => setSummary(data));
    }
  }, []);

  if (!hasModule('management')) {
    return (
      <div className="page">
        <h2>Welcome, {user?.name?.split(' ')[0]}</h2>
        <p className="hint-text">Use the sections in the sidebar to get started.</p>
      </div>
    );
  }

  if (!summary) {
    return <div className="page"><h2>Dashboard</h2><p className="hint-text">Loading…</p></div>;
  }

  const totalOutstanding = summary.pending_payments.reduce((s, p) => s + Number(p.outstanding), 0);
  const totalOverdue = summary.overdue_orders.length;

  return (
    <div className="page">
      <h2>Dashboard</h2>
      <p className="hint-text">Welcome, {user?.name?.split(' ')[0]} — here's where things stand across the business.</p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard label="Overdue Orders" value={totalOverdue} color={totalOverdue > 0 ? 'var(--red)' : 'var(--green)'} />
        <StatCard label="Outstanding Payments" value={`₹${totalOutstanding.toLocaleString('en-IN')}`} color={totalOutstanding > 0 ? 'var(--amber)' : 'var(--green)'} />
        <StatCard label="Vendor Deliveries Delayed" value={summary.vendor_delivery_delays.length} color={summary.vendor_delivery_delays.length > 0 ? 'var(--red)' : 'var(--green)'} />
        <StatCard label="Lab Results Pending" value={summary.lab_results_pending} />
        <StatCard label="Production Bottlenecks" value={summary.production_bottlenecks.length} color={summary.production_bottlenecks.length > 0 ? 'var(--amber)' : 'var(--green)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3 style={{ fontSize: 14 }}>Orders by status</h3>
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table className="data-table">
              <tbody>
                {summary.orders_by_status.map((s) => (
                  <tr key={s.status}><td>{STATUS_LABELS[s.status] || s.status}</td><td style={{ textAlign: 'right' }}>{s.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 14 }}>Overdue orders</h3>
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table className="data-table">
              <thead><tr><th>Work Order</th><th>Item</th><th>Promised</th></tr></thead>
              <tbody>
                {summary.overdue_orders.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>None — good shape.</td></tr>}
                {summary.overdue_orders.map((o) => (
                  <tr key={o.work_order_id}><td>{o.work_order_id}</td><td>{o.item_description}</td><td style={{ color: 'var(--red)' }}>{formatDate(o.promised_delivery_date)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 14 }}>Vendor delivery delays</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Vendor PO</th><th>Vendor</th><th>Promised</th></tr></thead>
              <tbody>
                {summary.vendor_delivery_delays.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>None — good shape.</td></tr>}
                {summary.vendor_delivery_delays.map((v) => (
                  <tr key={v.vendor_po_id}><td>{v.vendor_po_id}</td><td>{v.vendor_id}</td><td style={{ color: 'var(--red)' }}>{formatDate(v.promised_delivery_date)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 14 }}>Rejection rate by vendor</h3>
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table className="data-table">
              <thead><tr><th>Vendor</th><th>Rejections</th></tr></thead>
              <tbody>
                {summary.rejection_rate_by_vendor.length === 0 && <tr><td colSpan={2} style={{ color: 'var(--text-muted)' }}>No rejections logged.</td></tr>}
                {summary.rejection_rate_by_vendor.map((r) => (
                  <tr key={r.vendor_name}><td>{r.vendor_name}</td><td>{r.rejection_count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: 14 }}>Production bottlenecks</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Work Order</th><th>Item</th><th>RM to order</th></tr></thead>
              <tbody>
                {summary.production_bottlenecks.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--text-muted)' }}>None — good shape.</td></tr>}
                {summary.production_bottlenecks.map((p) => (
                  <tr key={p.work_order_id}><td>{p.work_order_id}</td><td>{p.item_description}</td><td style={{ color: Number(p.raw_material_to_order) > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>{p.raw_material_to_order ?? 0}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
