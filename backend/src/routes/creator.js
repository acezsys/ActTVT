const express = require('express');
const crypto = require('crypto');
const pool = require('../db');

const router = express.Router();

// Deliberately NOT using requireAuth/requireRole — this is a parallel gate,
// entirely outside the users table and the Superadmin/Module Admin hierarchy.
// The key lives only in the server's environment variables.
function checkCreatorKey(req, res, next) {
  const configuredKey = process.env.CREATOR_ACCESS_KEY;
  const providedKey = req.params.key || '';

  // If no key is configured, the panel is inert (fails closed, not open).
  if (!configuredKey) return res.status(404).json({ error: 'Not found.' });

  const a = Buffer.from(providedKey.padEnd(64, '\0'));
  const b = Buffer.from(configuredKey.padEnd(64, '\0'));
  const match = a.length === b.length && crypto.timingSafeEqual(a, b) && providedKey === configuredKey;

  if (!match) return res.status(404).json({ error: 'Not found.' }); // 404, not 401/403 — don't reveal this exists
  next();
}

router.get('/:key/modules', checkCreatorKey, async (req, res) => {
  const { rows } = await pool.query('SELECT module, is_enabled, updated_at FROM module_settings ORDER BY module');
  res.json(rows);
});

router.put('/:key/modules/:module', checkCreatorKey, async (req, res) => {
  const { is_enabled } = req.body;
  const { rows } = await pool.query(
    `UPDATE module_settings SET is_enabled = $1, updated_at = now() WHERE module = $2 RETURNING *`,
    [is_enabled, req.params.module]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found.' });
  res.json(rows[0]);
});

module.exports = router;
