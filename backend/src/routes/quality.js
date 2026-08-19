const express = require('express');
const pool = require('../db');
const { requireModuleAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleAccess('quality'));

// Quality doesn't own its own table — lab data is entered inline against a
// Vendor PO line during receipt (see Purchase module). This is a focused
// cross-reference view + a way to update results centrally without needing
// to open the full PO screen.

router.get('/', async (req, res) => {
  const { lab_result } = req.query;
  const conditions = ["l.lab_report_no IS NOT NULL OR l.lab_result != 'pending'"];
  const params = [];
  if (lab_result) { params.push(lab_result); conditions.push(`l.lab_result = $${params.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await pool.query(
    `SELECT l.id, l.vendor_po_id, l.line_type, l.quantity, l.received_qty, l.stock_no,
            l.lab_name, l.lab_result, l.lab_report_no, l.remarks, l.created_at,
            p.vendor_id, v.vendor_name, pt.description AS part_description
     FROM vendor_po_lines l
     JOIN vendor_pos p ON p.vendor_po_id = l.vendor_po_id
     JOIN vendors v ON v.vendor_id = p.vendor_id
     LEFT JOIN parts pt ON pt.part_id = l.part_id
     ${where}
     ORDER BY l.created_at DESC`, params
  );
  res.json(rows);
});

// Update lab fields directly from the Quality screen (mirrors the endpoint in
// Purchase — same underlying line, just a more convenient entry point for
// whoever owns Quality day-to-day).
router.put('/:lineId', async (req, res) => {
  const { lab_name, lab_result, lab_report_no, remarks } = req.body;
  const { rows } = await pool.query(
    `UPDATE vendor_po_lines SET lab_name=$1, lab_result=$2, lab_report_no=$3, remarks=$4 WHERE id=$5 RETURNING *`,
    [lab_name || null, lab_result || 'pending', lab_report_no || null, remarks, req.params.lineId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json(rows[0]);
});

module.exports = router;
