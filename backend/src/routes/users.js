const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { requireRole } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const router = express.Router();

// Superadmin and Module Admins can both see the roster.
router.get('/', requireRole('superadmin', 'module_admin'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.job_title, u.is_active,
            COALESCE(json_agg(json_build_object('module', a.module, 'can_edit', a.can_edit)) FILTER (WHERE a.module IS NOT NULL), '[]') AS module_access
     FROM users u
     LEFT JOIN user_module_access a ON a.user_id = u.id
     GROUP BY u.id ORDER BY u.name`
  );
  res.json(rows);
});

// --- Login lifecycle: Superadmin ONLY (confirmed spec) ---------------------

router.post('/', requireRole('superadmin'), async (req, res) => {
  const { name, email, job_title, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
  if (!['superadmin', 'module_admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  // Generate a temporary password; the user sets their own via the emailed link on first login.
  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, job_title, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, job_title`,
    [name, email.toLowerCase(), passwordHash, role, job_title, req.user.id]
  );

  await sendMail({
    to: email,
    subject: 'Your account — Order Management ERP',
    text: `Hi ${name}, an account has been created for you. Use "Forgot password" on the login page with this email to set your own password.`,
  });

  res.status(201).json(rows[0]);
});

router.put('/:id', requireRole('superadmin'), async (req, res) => {
  const { name, job_title, role, is_active } = req.body;
  const { rows } = await pool.query(
    `UPDATE users SET name = COALESCE($1,name), job_title = COALESCE($2,job_title),
     role = COALESCE($3,role), is_active = COALESCE($4,is_active) WHERE id = $5
     RETURNING id, name, email, role, job_title, is_active`,
    [name, job_title, role, is_active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
  res.json(rows[0]);
});

router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account." });
  await pool.query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);
  res.json({ message: 'User deactivated.' });
});

// --- Module access: Superadmin, or a Module Admin for THEIR OWN module -----

router.post('/:id/module-access', requireRole('superadmin', 'module_admin'), async (req, res) => {
  const { module, can_edit } = req.body;

  if (req.user.role === 'module_admin') {
    const { rows } = await pool.query(
      'SELECT 1 FROM user_module_access WHERE user_id = $1 AND module = $2',
      [req.user.id, module]
    );
    if (rows.length === 0) {
      return res.status(403).json({ error: 'You can only assign access for modules you administer.' });
    }
  }

  await pool.query(
    `INSERT INTO user_module_access (user_id, module, can_edit, granted_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, module) DO UPDATE SET can_edit = $3, granted_by = $4, granted_at = now()`,
    [req.params.id, module, can_edit !== false, req.user.id]
  );
  res.json({ message: 'Module access updated.' });
});

router.delete('/:id/module-access/:module', requireRole('superadmin', 'module_admin'), async (req, res) => {
  if (req.user.role === 'module_admin') {
    const { rows } = await pool.query(
      'SELECT 1 FROM user_module_access WHERE user_id = $1 AND module = $2',
      [req.user.id, req.params.module]
    );
    if (rows.length === 0) {
      return res.status(403).json({ error: 'You can only revoke access for modules you administer.' });
    }
  }
  await pool.query('DELETE FROM user_module_access WHERE user_id = $1 AND module = $2', [req.params.id, req.params.module]);
  res.json({ message: 'Module access revoked.' });
});

module.exports = router;
