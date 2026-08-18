const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { nextFormattedId } = require('../utils/idGenerator');

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM vendors WHERE is_active = true ORDER BY vendor_name');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM vendors WHERE vendor_id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Vendor not found.' });
  res.json(rows[0]);
});

router.post('/', requireRole('superadmin'), async (req, res) => {
  const { vendor_name, contact_person, phone, email, gstin, address, category, rating } = req.body;
  if (!vendor_name) return res.status(400).json({ error: 'Vendor name is required.' });

  const vendorId = await nextFormattedId('VN', 'vendor_id_seq');
  const { rows } = await pool.query(
    `INSERT INTO vendors (vendor_id, vendor_name, contact_person, phone, email, gstin, address, category, rating, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [vendorId, vendor_name, contact_person, phone, email, gstin, address, category, rating || null, req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireRole('superadmin'), async (req, res) => {
  const { vendor_name, contact_person, phone, email, gstin, address, category, rating } = req.body;
  const { rows } = await pool.query(
    `UPDATE vendors SET vendor_name=$1, contact_person=$2, phone=$3, email=$4, gstin=$5,
     address=$6, category=$7, rating=$8 WHERE vendor_id=$9 RETURNING *`,
    [vendor_name, contact_person, phone, email, gstin, address, category, rating || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Vendor not found.' });
  res.json(rows[0]);
});

router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  await pool.query('UPDATE vendors SET is_active = false WHERE vendor_id = $1', [req.params.id]);
  res.json({ message: 'Vendor deactivated.' });
});

module.exports = router;
