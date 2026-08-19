const express = require('express');
const pool = require('../db');
const { requireModuleAccess } = require('../middleware/auth');
const { nextFormattedId } = require('../utils/idGenerator');

const router = express.Router();

// Everyone with access to the tender_bid module can view and log entries —
// this isn't a superadmin-only master-data table like Clients/Vendors/Parts.
router.use(requireModuleAccess('tender_bid'));

router.get('/', async (req, res) => {
  const { status, result } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`bid_status = $${params.length}`); }
  if (result) { params.push(result); conditions.push(`result = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM tenders_bids ${where} ORDER BY bid_submission_due ASC`, params
  );
  res.json(rows);
});

router.get('/:orderId', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tenders_bids WHERE order_id = $1', [req.params.orderId]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { item_description, quantity, bid_submission_due, bid_status, result, tender_id, notes } = req.body;
  if (!item_description || !quantity || !bid_submission_due) {
    return res.status(400).json({ error: 'Item description, quantity, and Bid Submission Due Date are required.' });
  }

  const orderId = await nextFormattedId('ORD', 'tender_order_id_seq');
  const { rows } = await pool.query(
    `INSERT INTO tenders_bids (order_id, item_description, quantity, bid_submission_due, bid_status, result, tender_id, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [orderId, item_description, quantity, bid_submission_due, bid_status || 'not_quoted', result || 'pending', tender_id || null, notes || null, req.user.id]
  );
  await logStatus('tenders_bids', orderId, null, rows[0].bid_status, req.user.id, 'Bid created');
  res.status(201).json(rows[0]);
});

router.put('/:orderId', async (req, res) => {
  const existing = await pool.query('SELECT result FROM tenders_bids WHERE order_id = $1', [req.params.orderId]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Not found.' });

  const { item_description, quantity, bid_submission_due, bid_status, result, po_id, tender_id, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE tenders_bids SET item_description=$1, quantity=$2, bid_submission_due=$3, bid_status=$4,
     result=$5, po_id=$6, tender_id=$7, notes=$8 WHERE order_id=$9 RETURNING *`,
    [item_description, quantity, bid_submission_due, bid_status, result, po_id || null, tender_id || null, notes, req.params.orderId]
  );

  if (result && result !== existing.rows[0].result) {
    await logStatus('tenders_bids', req.params.orderId, existing.rows[0].result, result, req.user.id, 'Result updated');
  }
  res.json(rows[0]);
});

async function logStatus(entityType, entityId, from, to, userId, note) {
  await pool.query(
    `INSERT INTO status_history (entity_type, entity_id, from_status, to_status, changed_by, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entityType, entityId, from, to, userId, note]
  );
}

module.exports = router;
