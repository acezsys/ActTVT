const express = require('express');
const pool = require('../db');

const router = express.Router();

// No auth on purpose — this just tells the frontend which nav items to show.
// It reveals nothing sensitive (just which of the 8 optional modules exist
// in this deployment), and every actual module route is independently
// protected by requireModuleEnabled regardless of what this returns.
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT module, is_enabled FROM module_settings');
  res.json(rows);
});

module.exports = router;
