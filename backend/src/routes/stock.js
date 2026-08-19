const express = require('express');
const pool = require('../db');
const { requireModuleAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleAccess('stores'));

// Aggregated balance per part — the main "Stock Ledger" view.
// MUST be declared before '/:id' style routes if any are added later.
router.get('/balance', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.part_id, p.description, p.unit,
            COALESCE(SUM(s.purchase_qty), 0) AS total_purchased,
            COALESCE(SUM(s.issued_qty), 0) AS total_issued,
            COALESCE(SUM(s.purchase_qty), 0) - COALESCE(SUM(s.issued_qty), 0) AS net_balance
     FROM parts p
     LEFT JOIN stock_ledger s ON s.part_id = p.part_id
     WHERE p.is_active = true
     GROUP BY p.part_id, p.description, p.unit
     ORDER BY p.description`
  );
  res.json(rows);
});

// Transaction log — every purchase-in and issue-out entry, newest first.
router.get('/', async (req, res) => {
  const { part_id, work_order_id } = req.query;
  const conditions = [];
  const params = [];
  if (part_id) { params.push(part_id); conditions.push(`s.part_id = $${params.length}`); }
  if (work_order_id) { params.push(work_order_id); conditions.push(`s.work_order_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT s.*, p.description AS part_description FROM stock_ledger s
     JOIN parts p ON p.part_id = s.part_id
     ${where} ORDER BY s.transaction_date DESC, s.created_at DESC`, params
  );
  res.json(rows);
});

// Record incoming stock (e.g. from a vendor PO receipt).
router.post('/receipts', async (req, res) => {
  const { part_id, purchase_qty, unit, lab_report_no, transaction_date } = req.body;
  if (!part_id || !purchase_qty) return res.status(400).json({ error: 'Part and quantity are required.' });

  const { rows } = await pool.query(
    `INSERT INTO stock_ledger (part_id, purchase_qty, issued_qty, unit, lab_report_no, transaction_date, created_by)
     VALUES ($1,$2,0,$3,$4,COALESCE($5, CURRENT_DATE),$6) RETURNING *`,
    [part_id, purchase_qty, unit || null, lab_report_no || null, transaction_date || null, req.user.id]
  );
  res.status(201).json(rows[0]);
});

// Issue stock to a work order — blocked if it would take the balance negative,
// which is the practical equivalent of the confirmed lean-material-planning rule
// (don't let production draw more than what's actually in stock).
router.post('/issues', async (req, res) => {
  const { part_id, work_order_id, issued_qty, unit, transaction_date } = req.body;
  if (!part_id || !work_order_id || !issued_qty) {
    return res.status(400).json({ error: 'Part, Work Order, and quantity are required.' });
  }

  const balanceResult = await pool.query(
    `SELECT COALESCE(SUM(purchase_qty),0) - COALESCE(SUM(issued_qty),0) AS balance FROM stock_ledger WHERE part_id = $1`,
    [part_id]
  );
  const available = Number(balanceResult.rows[0].balance);
  if (Number(issued_qty) > available) {
    return res.status(400).json({ error: `Only ${available} in stock — cannot issue ${issued_qty}.` });
  }

  const { rows } = await pool.query(
    `INSERT INTO stock_ledger (part_id, work_order_id, purchase_qty, issued_qty, unit, transaction_date, created_by)
     VALUES ($1,$2,0,$3,$4,COALESCE($5, CURRENT_DATE),$6) RETURNING *`,
    [part_id, work_order_id, issued_qty, unit || null, transaction_date || null, req.user.id]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
