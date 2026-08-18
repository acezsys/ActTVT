const express = require('express');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { randomClientId } = require('../utils/idGenerator');

const router = express.Router();

// Anyone logged in can view clients (needed across Sales/Dispatch/etc).
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients WHERE is_active = true ORDER BY client_name');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients WHERE client_id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Client not found.' });
  res.json(rows[0]);
});

// Only Superadmin can create/edit/delete master data, per confirmed spec.
router.post('/', requireRole('superadmin'), async (req, res) => {
  const { client_name, contact_person, client_mobile, client_email, client_address, client_dispatch_address, client_gst } = req.body;
  if (!client_name) return res.status(400).json({ error: 'Client name is required.' });

  let clientId, attempts = 0;
  do {
    clientId = randomClientId();
    const { rows } = await pool.query('SELECT 1 FROM clients WHERE client_id = $1', [clientId]);
    if (rows.length === 0) break;
    attempts++;
  } while (attempts < 5);

  const { rows } = await pool.query(
    `INSERT INTO clients (client_id, client_name, contact_person, client_mobile, client_email, client_address, client_dispatch_address, client_gst, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [clientId, client_name, contact_person, client_mobile, client_email, client_address, client_dispatch_address, client_gst, req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', requireRole('superadmin'), async (req, res) => {
  const { client_name, contact_person, client_mobile, client_email, client_address, client_dispatch_address, client_gst } = req.body;
  const { rows } = await pool.query(
    `UPDATE clients SET client_name=$1, contact_person=$2, client_mobile=$3, client_email=$4,
     client_address=$5, client_dispatch_address=$6, client_gst=$7 WHERE client_id=$8 RETURNING *`,
    [client_name, contact_person, client_mobile, client_email, client_address, client_dispatch_address, client_gst, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Client not found.' });
  res.json(rows[0]);
});

router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  await pool.query('UPDATE clients SET is_active = false WHERE client_id = $1', [req.params.id]);
  res.json({ message: 'Client deactivated.' });
});

module.exports = router;
