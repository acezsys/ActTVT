const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { nextFormattedId } = require('../utils/idGenerator');

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM parts WHERE is_active = true ORDER BY description');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM parts WHERE part_id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Part not found.' });
  res.json(rows[0]);
});

router.post('/', requireRole('superadmin'), async (req, res) => {
  const { description, hsn_code, unit, drawing_ref } = req.body;
  if (!description) return res.status(400).json({ error: 'Description is required.' });

  const partId = await nextFormattedId('PN', 'part_id_seq');
  const { rows } = await pool.query(
    `INSERT INTO parts (part_id, description, hsn_code, unit, drawing_ref) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [partId, description, hsn_code, unit, drawing_ref]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireRole('superadmin'), async (req, res) => {
  const { description, hsn_code, unit, drawing_ref } = req.body;
  const { rows } = await pool.query(
    `UPDATE parts SET description=$1, hsn_code=$2, unit=$3, drawing_ref=$4 WHERE part_id=$5 RETURNING *`,
    [description, hsn_code, unit, drawing_ref, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Part not found.' });
  res.json(rows[0]);
});

router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  await pool.query('UPDATE parts SET is_active = false WHERE part_id = $1', [req.params.id]);
  res.json({ message: 'Part deactivated.' });
});

module.exports = router;
