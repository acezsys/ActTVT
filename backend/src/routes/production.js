const express = require('express');
const pool = require('../db');
const { requireModuleAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleAccess('production'));

// One row per Work Order — the row itself is auto-created when the Work Order
// is created (see workOrders.js), so this module only ever updates, never creates.

router.get('/', async (req, res) => {
  const { assembly_status, ready_for_inspection } = req.query;
  const conditions = [];
  const params = [];
  if (assembly_status) { params.push(assembly_status); conditions.push(`pt.assembly_status = $${params.length}`); }
  if (ready_for_inspection !== undefined) { params.push(ready_for_inspection === 'true'); conditions.push(`pt.ready_for_inspection = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT pt.*, w.item_description, w.quantity AS order_quantity, w.status AS work_order_status, c.client_name
     FROM production_tracking pt
     JOIN work_orders w ON w.work_order_id = pt.work_order_id
     JOIN clients c ON c.client_id = w.client_id
     ${where}
     ORDER BY pt.ready_for_inspection ASC, pt.updated_at DESC`, params
  );
  res.json(rows);
});

router.get('/:workOrderId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT pt.*, w.item_description, w.quantity AS order_quantity, c.client_name
     FROM production_tracking pt
     JOIN work_orders w ON w.work_order_id = pt.work_order_id
     JOIN clients c ON c.client_id = w.client_id
     WHERE pt.work_order_id = $1`,
    [req.params.workOrderId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found. (A Production row is created automatically with each Work Order.)' });
  res.json(rows[0]);
});

router.put('/:workOrderId', async (req, res) => {
  const { raw_material_required, raw_material_available, assembly_status, ready_for_inspection, remarks } = req.body;

  const { rows } = await pool.query(
    `UPDATE production_tracking SET raw_material_required=$1, raw_material_available=$2,
     assembly_status=$3, ready_for_inspection=$4, remarks=$5, updated_by=$6, updated_at=now()
     WHERE work_order_id=$7 RETURNING *`,
    [raw_material_required ?? null, raw_material_available ?? null, assembly_status || 'not_started',
     ready_for_inspection === true, remarks || null, req.user.id, req.params.workOrderId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json(rows[0]);
});

module.exports = router;
