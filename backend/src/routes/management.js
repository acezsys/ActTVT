const express = require('express');
const pool = require('../db');
const { requireModuleAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleAccess('management'));

router.get('/summary', async (req, res) => {
  const [ordersByStatus, overdueOrders, payments, vendorDelays, labPending, rejections] = await Promise.all([
    pool.query(`SELECT status, COUNT(*) AS count FROM work_orders GROUP BY status`),

    pool.query(`SELECT work_order_id, item_description, promised_delivery_date, status FROM work_orders
                WHERE promised_delivery_date < CURRENT_DATE AND status NOT IN ('completed','closed')
                ORDER BY promised_delivery_date ASC`),

    pool.query(`SELECT payment_status, COUNT(*) AS count, COALESCE(SUM(total_amount - amount_paid),0) AS outstanding
                FROM invoices WHERE payment_status != 'paid' GROUP BY payment_status`),

    pool.query(`SELECT vendor_po_id, vendor_id, promised_delivery_date, status FROM vendor_pos
                WHERE promised_delivery_date < CURRENT_DATE AND status NOT IN ('received','closed')
                ORDER BY promised_delivery_date ASC`),

    pool.query(`SELECT COUNT(*) AS count FROM vendor_po_lines WHERE lab_result = 'pending'`),

    pool.query(`SELECT v.vendor_name, COUNT(*) AS rejection_count
                FROM vendor_po_lines l
                JOIN vendor_pos p ON p.vendor_po_id = l.vendor_po_id
                JOIN vendors v ON v.vendor_id = p.vendor_id
                WHERE l.line_type IN ('rework','replacement')
                GROUP BY v.vendor_name ORDER BY rejection_count DESC`),
  ]);

  const productionBottlenecks = await pool.query(
    `SELECT pt.work_order_id, w.item_description, pt.raw_material_to_order, pt.assembly_status
     FROM production_tracking pt JOIN work_orders w ON w.work_order_id = pt.work_order_id
     WHERE pt.raw_material_to_order > 0 OR (pt.assembly_status != 'done' AND w.status NOT IN ('completed','closed'))
     ORDER BY pt.raw_material_to_order DESC NULLS LAST`
  );

  res.json({
    orders_by_status: ordersByStatus.rows,
    overdue_orders: overdueOrders.rows,
    pending_payments: payments.rows,
    vendor_delivery_delays: vendorDelays.rows,
    lab_results_pending: Number(labPending.rows[0].count),
    rejection_rate_by_vendor: rejections.rows,
    production_bottlenecks: productionBottlenecks.rows,
  });
});

// Monthly review — a filtered snapshot for a given month (YYYY-MM), covering
// orders received, dispatches, invoices raised, and payments collected.
router.get('/monthly-review', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  const [orders, dispatches, invoices, vendorPOs] = await Promise.all([
    pool.query(`SELECT work_order_id, item_description, quantity, value, status FROM work_orders
                WHERE to_char(created_at, 'YYYY-MM') = $1 ORDER BY created_at`, [month]),
    pool.query(`SELECT d.work_order_id, d.dispatch_date, d.dispatched_qty, d.challan_no FROM dispatches d
                WHERE to_char(d.dispatch_date, 'YYYY-MM') = $1 ORDER BY d.dispatch_date`, [month]),
    pool.query(`SELECT invoice_id, work_order_id, invoice_date, total_amount, payment_status FROM invoices
                WHERE to_char(invoice_date, 'YYYY-MM') = $1 ORDER BY invoice_date`, [month]),
    pool.query(`SELECT vendor_po_id, vendor_id, status FROM vendor_pos
                WHERE to_char(created_at, 'YYYY-MM') = $1 ORDER BY created_at`, [month]),
  ]);

  const totalOrderValue = orders.rows.reduce((s, o) => s + Number(o.value || 0), 0);
  const totalInvoiced = invoices.rows.reduce((s, i) => s + Number(i.total_amount || 0), 0);

  res.json({
    month,
    orders: orders.rows,
    dispatches: dispatches.rows,
    invoices: invoices.rows,
    vendor_pos: vendorPOs.rows,
    totals: {
      orders_count: orders.rows.length,
      total_order_value: totalOrderValue,
      dispatches_count: dispatches.rows.length,
      invoices_count: invoices.rows.length,
      total_invoiced: totalInvoiced,
      vendor_pos_count: vendorPOs.rows.length,
    },
  });
});

module.exports = router;
