const express = require('express');
const pool = require('../db');
const { requireModuleAccess } = require('../middleware/auth');
const { nextFormattedId } = require('../utils/idGenerator');

const router = express.Router();
router.use(requireModuleAccess('purchase'));

// --- Vendor POs (header) -----------------------------------------------

router.get('/', async (req, res) => {
  const { status, vendor_id } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
  if (vendor_id) { params.push(vendor_id); conditions.push(`p.vendor_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT p.*, v.vendor_name FROM vendor_pos p JOIN vendors v ON v.vendor_id = p.vendor_id
     ${where} ORDER BY p.created_at DESC`, params
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const poResult = await pool.query(
    `SELECT p.*, v.vendor_name FROM vendor_pos p JOIN vendors v ON v.vendor_id = p.vendor_id WHERE p.vendor_po_id = $1`,
    [req.params.id]
  );
  if (!poResult.rows[0]) return res.status(404).json({ error: 'Vendor PO not found.' });

  const linesResult = await pool.query(
    `SELECT l.*, pt.description AS part_description FROM vendor_po_lines l
     LEFT JOIN parts pt ON pt.part_id = l.part_id
     WHERE l.vendor_po_id = $1 ORDER BY l.created_at ASC`,
    [req.params.id]
  );
  res.json({ ...poResult.rows[0], lines: linesResult.rows });
});

router.post('/', async (req, res) => {
  const { vendor_id, work_order_id, enquiry_ref, quotation_ref, delivery_period_days, promised_delivery_date, remarks } = req.body;
  if (!vendor_id) return res.status(400).json({ error: 'Vendor is required.' });

  const poId = await nextFormattedId('PO', 'vendor_po_id_seq');
  const { rows } = await pool.query(
    `INSERT INTO vendor_pos (vendor_po_id, vendor_id, work_order_id, enquiry_ref, quotation_ref,
       delivery_period_days, promised_delivery_date, remarks, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'issued',$9) RETURNING *`,
    [poId, vendor_id, work_order_id || null, enquiry_ref || null, quotation_ref || null,
     delivery_period_days || null, promised_delivery_date || null, remarks || null, req.user.id]
  );

  await pool.query(
    `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
     VALUES ('vendor_pos', $1, NULL, 'issued', $2, 'Vendor PO created')`,
    [poId, req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const existing = await pool.query('SELECT status FROM vendor_pos WHERE vendor_po_id = $1', [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Vendor PO not found.' });

  const { delivery_period_days, promised_delivery_date, status, vendor_payment_status, remarks } = req.body;
  const { rows } = await pool.query(
    `UPDATE vendor_pos SET delivery_period_days=$1, promised_delivery_date=$2, status=$3,
     vendor_payment_status=$4, remarks=$5 WHERE vendor_po_id=$6 RETURNING *`,
    [delivery_period_days || null, promised_delivery_date || null, status, vendor_payment_status, remarks, req.params.id]
  );

  if (status && status !== existing.rows[0].status) {
    await pool.query(
      `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
       VALUES ('vendor_pos', $1, $2, $3, $4, 'Status updated')`,
      [req.params.id, existing.rows[0].status, status, req.user.id]
    );
  }
  res.json(rows[0]);
});

// --- Vendor PO lines (items, receipts, lab results, rejections) --------

router.post('/:id/lines', async (req, res) => {
  const { part_id, quantity, rate, remarks } = req.body;
  if (!quantity) return res.status(400).json({ error: 'Quantity is required.' });

  const { rows } = await pool.query(
    `INSERT INTO vendor_po_lines (vendor_po_id, part_id, line_type, quantity, rate, remarks)
     VALUES ($1,$2,'original',$3,$4,$5) RETURNING *`,
    [req.params.id, part_id || null, quantity, rate || null, remarks || null]
  );
  res.status(201).json(rows[0]);
});

// Record receipt + lab result against an existing line.
router.put('/:id/lines/:lineId', async (req, res) => {
  const { received_qty, stock_no, lab_name, lab_result, lab_report_no, remarks } = req.body;
  const { rows } = await pool.query(
    `UPDATE vendor_po_lines SET received_qty=$1, stock_no=$2, lab_name=$3, lab_result=$4, lab_report_no=$5, remarks=$6
     WHERE id=$7 AND vendor_po_id=$8 RETURNING *`,
    [received_qty, stock_no || null, lab_name || null, lab_result || 'pending', lab_report_no || null, remarks, req.params.lineId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Line not found.' });
  res.json(rows[0]);
});

// Rejection handling — CONFIRMED Option A: a rejected item becomes a NEW LINE
// on the SAME vendor PO (not a new PO), linked back to the original line.
router.post('/:id/lines/:lineId/reject', async (req, res) => {
  const { line_type, quantity, remarks } = req.body; // line_type: 'rework' | 'replacement'
  if (!['rework', 'replacement'].includes(line_type)) {
    return res.status(400).json({ error: "line_type must be 'rework' or 'replacement'." });
  }

  const original = await pool.query('SELECT * FROM vendor_po_lines WHERE id = $1 AND vendor_po_id = $2', [req.params.lineId, req.params.id]);
  if (!original.rows[0]) return res.status(404).json({ error: 'Original line not found.' });

  const orig = original.rows[0];
  const { rows } = await pool.query(
    `INSERT INTO vendor_po_lines (vendor_po_id, part_id, line_type, original_line_id, quantity, rate, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.id, orig.part_id, line_type, orig.id, quantity || orig.quantity, orig.rate, remarks || `${line_type} for rejected line`]
  );

  // Mark the original line's lab result as failed if not already set, so the rejection reason is visible.
  await pool.query(`UPDATE vendor_po_lines SET lab_result = 'fail' WHERE id = $1 AND lab_result = 'pending'`, [orig.id]);

  res.status(201).json(rows[0]);
});

module.exports = router;
