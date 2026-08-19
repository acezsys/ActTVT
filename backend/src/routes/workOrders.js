const express = require('express');
const pool = require('../db');
const { requireModuleAccess } = require('../middleware/auth');
const { nextFormattedId } = require('../utils/idGenerator');

const router = express.Router();
router.use(requireModuleAccess('sales'));

router.get('/', async (req, res) => {
  const { status, payment_status, client_id } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`w.status = $${params.length}`); }
  if (payment_status) { params.push(payment_status); conditions.push(`w.payment_status = $${params.length}`); }
  if (client_id) { params.push(client_id); conditions.push(`w.client_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT w.*, c.client_name
     FROM work_orders w JOIN clients c ON c.client_id = w.client_id
     ${where} ORDER BY w.created_at DESC`, params
  );
  res.json(rows);
});

// Convenience endpoint: Won bids ready to become a Work Order (used by the "New from Bid" flow)
// MUST be declared before '/:id' so Express doesn't treat "available-won-bids" as an id.
router.get('/available-won-bids/list', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT tb.* FROM tenders_bids tb
     WHERE tb.result = 'won' AND tb.po_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM work_orders w WHERE w.po_id = tb.po_id)
     ORDER BY tb.bid_submission_due DESC`
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT w.*, c.client_name FROM work_orders w JOIN clients c ON c.client_id = w.client_id WHERE w.work_order_id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Work order not found.' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const {
    po_id, client_id, item_description, quantity, rate,
    delivery_period_days, promised_delivery_date, bill_no,
    deduction_tds, deduction_ld, deduction_sd, deduction_misc, remarks,
  } = req.body;

  if (!client_id || !item_description || !quantity || !rate) {
    return res.status(400).json({ error: 'Client, item description, quantity, and rate are required.' });
  }

  const workOrderId = await nextFormattedId('SO', 'work_order_id_seq');
  const { rows } = await pool.query(
    `INSERT INTO work_orders (work_order_id, po_id, client_id, item_description, quantity, rate,
       delivery_period_days, promised_delivery_date, bill_no, deduction_tds, deduction_ld, deduction_sd,
       deduction_misc, remarks, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'received',$15) RETURNING *`,
    [workOrderId, po_id || null, client_id, item_description, quantity, rate, delivery_period_days || null,
     promised_delivery_date || null, bill_no || null, deduction_tds || 0, deduction_ld || 0, deduction_sd || 0,
     deduction_misc || 0, remarks || null, req.user.id]
  );

  await pool.query(
    `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
     VALUES ('work_orders', $1, NULL, 'received', $2, 'Work order created')`,
    [workOrderId, req.user.id]
  );

  // Auto-create the linked Production tracking row so Production module has something to update.
  await pool.query(`INSERT INTO production_tracking (work_order_id) VALUES ($1)`, [workOrderId]);

  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const existing = await pool.query('SELECT status FROM work_orders WHERE work_order_id = $1', [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Work order not found.' });

  const {
    item_description, quantity, rate, delivery_period_days, promised_delivery_date,
    actual_delivery_date, bill_no, payment_status, deduction_tds, deduction_ld,
    deduction_sd, deduction_misc, status, remarks,
  } = req.body;

  const { rows } = await pool.query(
    `UPDATE work_orders SET item_description=$1, quantity=$2, rate=$3, delivery_period_days=$4,
     promised_delivery_date=$5, actual_delivery_date=$6, bill_no=$7, payment_status=$8,
     deduction_tds=$9, deduction_ld=$10, deduction_sd=$11, deduction_misc=$12, status=$13, remarks=$14
     WHERE work_order_id=$15 RETURNING *`,
    [item_description, quantity, rate, delivery_period_days || null, promised_delivery_date || null,
     actual_delivery_date || null, bill_no, payment_status, deduction_tds || 0, deduction_ld || 0,
     deduction_sd || 0, deduction_misc || 0, status, remarks, req.params.id]
  );

  if (status && status !== existing.rows[0].status) {
    await pool.query(
      `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
       VALUES ('work_orders', $1, $2, $3, $4, 'Status updated')`,
      [req.params.id, existing.rows[0].status, status, req.user.id]
    );
  }
  res.json(rows[0]);
});

module.exports = router;
