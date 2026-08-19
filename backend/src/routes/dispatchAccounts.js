const express = require('express');
const pool = require('../db');
const { requireModuleAccess } = require('../middleware/auth');
const { nextFormattedId } = require('../utils/idGenerator');

const router = express.Router();
router.use(requireModuleAccess('dispatch_accounts'));

// Seller's home state code (from the confirmed sample invoice: Maharashtra, Code 27).
// Used to decide IGST (inter-state) vs CGST+SGST (intra-state) automatically.
const SELLER_STATE_CODE = '27';

function stateCodeFromGstin(gstin) {
  return gstin ? gstin.slice(0, 2) : null;
}

// --- Dispatches ----------------------------------------------------------

router.get('/dispatches', async (req, res) => {
  const { work_order_id } = req.query;
  const params = [];
  let where = '';
  if (work_order_id) { params.push(work_order_id); where = 'WHERE d.work_order_id = $1'; }
  const { rows } = await pool.query(
    `SELECT d.*, w.item_description FROM dispatches d JOIN work_orders w ON w.work_order_id = d.work_order_id
     ${where} ORDER BY d.dispatch_date DESC`, params
  );
  res.json(rows);
});

router.post('/dispatches', async (req, res) => {
  const { work_order_id, dispatch_date, challan_no, dispatched_qty, dispatched_through, destination } = req.body;
  if (!work_order_id || !dispatch_date || !dispatched_qty) {
    return res.status(400).json({ error: 'Work Order, dispatch date, and quantity are required.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO dispatches (work_order_id, dispatch_date, challan_no, dispatched_qty, dispatched_through, destination, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [work_order_id, dispatch_date, challan_no || null, dispatched_qty, dispatched_through || null, destination || null, req.user.id]
  );

  // Auto-update Work Order status to reflect dispatch progress.
  const totals = await pool.query(
    `SELECT w.quantity, COALESCE(SUM(d.dispatched_qty),0) AS dispatched
     FROM work_orders w LEFT JOIN dispatches d ON d.work_order_id = w.work_order_id
     WHERE w.work_order_id = $1 GROUP BY w.quantity`,
    [work_order_id]
  );
  const { quantity, dispatched } = totals.rows[0];
  const newStatus = Number(dispatched) >= Number(quantity) ? 'completed' : 'partially_dispatched';
  await pool.query(`UPDATE work_orders SET status = $1 WHERE work_order_id = $2`, [newStatus, work_order_id]);

  res.status(201).json(rows[0]);
});

// --- Invoices --------------------------------------------------------------

router.get('/invoices', async (req, res) => {
  const { payment_status, work_order_id } = req.query;
  const conditions = [];
  const params = [];
  if (payment_status) { params.push(payment_status); conditions.push(`i.payment_status = $${params.length}`); }
  if (work_order_id) { params.push(work_order_id); conditions.push(`i.work_order_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT i.*, w.item_description, c.client_name FROM invoices i
     JOIN work_orders w ON w.work_order_id = i.work_order_id
     JOIN clients c ON c.client_id = w.client_id
     ${where} ORDER BY i.invoice_date DESC`, params
  );
  res.json(rows);
});

router.get('/invoices/:id', async (req, res) => {
  const invResult = await pool.query(
    `SELECT i.*, w.item_description, w.client_id, c.client_name, c.client_gst, c.client_address,
            c.client_dispatch_address, c.contact_person AS client_contact
     FROM invoices i
     JOIN work_orders w ON w.work_order_id = i.work_order_id
     JOIN clients c ON c.client_id = w.client_id
     WHERE i.invoice_id = $1`,
    [req.params.id]
  );
  if (!invResult.rows[0]) return res.status(404).json({ error: 'Invoice not found.' });

  const linesResult = await pool.query(
    `SELECT * FROM invoice_lines WHERE invoice_id = $1
     ORDER BY CASE line_kind WHEN 'item' THEN 0 WHEN 'packing' THEN 1 WHEN 'forwarding' THEN 2 WHEN 'freight' THEN 3 ELSE 4 END, id`,
    [req.params.id]
  );
  res.json({ ...invResult.rows[0], lines: linesResult.rows });
});

// Creates an invoice + its line items. `lines` is an array of
// { description, drawing_ref, hsn_sac, gst_rate, quantity, rate, unit, discount_pct, line_kind }
router.post('/invoices', async (req, res) => {
  const { work_order_id, dispatch_id, buyers_order_no, buyers_order_date, due_date, lines } = req.body;
  if (!work_order_id || !lines || !lines.length) {
    return res.status(400).json({ error: 'Work Order and at least one line item are required.' });
  }

  const woResult = await pool.query(
    `SELECT w.*, c.client_gst FROM work_orders w JOIN clients c ON c.client_id = w.client_id WHERE w.work_order_id = $1`,
    [work_order_id]
  );
  if (!woResult.rows[0]) return res.status(404).json({ error: 'Work Order not found.' });

  const buyerState = stateCodeFromGstin(woResult.rows[0].client_gst);
  const taxType = buyerState && buyerState !== SELLER_STATE_CODE ? 'igst' : 'cgst_sgst';

  const taxableValue = lines.reduce((sum, l) => {
    const amt = Number(l.quantity || 1) * Number(l.rate || 0) * (1 - Number(l.discount_pct || 0) / 100);
    return sum + amt;
  }, 0);
  const gstRate = Number(lines[0]?.gst_rate) || 18;

  const invoiceId = await nextFormattedId('AIN', 'invoice_id_seq');
  const { rows } = await pool.query(
    `INSERT INTO invoices (invoice_id, work_order_id, dispatch_id, buyers_order_no, buyers_order_date,
       tax_type, taxable_value, tax_rate, due_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [invoiceId, work_order_id, dispatch_id || null, buyers_order_no || null, buyers_order_date || null,
     taxType, taxableValue, gstRate, due_date || null, req.user.id]
  );

  for (const l of lines) {
    const amount = Number(l.quantity || 1) * Number(l.rate || 0) * (1 - Number(l.discount_pct || 0) / 100);
    await pool.query(
      `INSERT INTO invoice_lines (invoice_id, description, drawing_ref, hsn_sac, gst_rate, quantity, rate, unit, discount_pct, amount, line_kind)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [invoiceId, l.description, l.drawing_ref || null, l.hsn_sac || null, l.gst_rate || gstRate,
       l.quantity || null, l.rate || null, l.unit || null, l.discount_pct || 0, amount, l.line_kind || 'item']
    );
  }

  res.status(201).json(rows[0]);
});

router.put('/invoices/:id/payment', async (req, res) => {
  const { payment_status, amount_paid } = req.body;
  const { rows } = await pool.query(
    `UPDATE invoices SET payment_status=$1, amount_paid=$2 WHERE invoice_id=$3 RETURNING *`,
    [payment_status, amount_paid, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invoice not found.' });

  // Mirror the payment status onto the parent Work Order too, so Sales sees it without a second update.
  await pool.query(`UPDATE work_orders SET payment_status = $1 WHERE work_order_id = $2`, [payment_status, rows[0].work_order_id]);

  res.json(rows[0]);
});

// --- PDF -------------------------------------------------------------------

router.get('/invoices/:id/pdf', async (req, res) => {
  const { generateInvoicePdf } = require('../utils/invoicePdf');
  const invResult = await pool.query(
    `SELECT i.*, w.item_description, w.client_id, c.client_name, c.client_gst, c.client_address,
            c.client_dispatch_address, c.contact_person AS client_contact
     FROM invoices i
     JOIN work_orders w ON w.work_order_id = i.work_order_id
     JOIN clients c ON c.client_id = w.client_id
     WHERE i.invoice_id = $1`,
    [req.params.id]
  );
  if (!invResult.rows[0]) return res.status(404).json({ error: 'Invoice not found.' });
  const linesResult = await pool.query(
    `SELECT * FROM invoice_lines WHERE invoice_id = $1
     ORDER BY CASE line_kind WHEN 'item' THEN 0 WHEN 'packing' THEN 1 WHEN 'forwarding' THEN 2 WHEN 'freight' THEN 3 ELSE 4 END, id`,
    [req.params.id]
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${req.params.id}.pdf"`);
  generateInvoicePdf({ invoice: invResult.rows[0], lines: linesResult.rows }).pipe(res);
});

module.exports = router;
