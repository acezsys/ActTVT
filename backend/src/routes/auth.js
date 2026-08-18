const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { verifyCheckboxCaptcha, generateTextCaptcha, verifyTextCaptcha } = require('../utils/captcha');
const { sendMail } = require('../utils/mailer');

const router = express.Router();

// GET a fresh text captcha challenge (used before password reset / other sensitive actions)
router.get('/text-captcha', (req, res) => {
  res.json(generateTextCaptcha());
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password, captchaToken } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const captchaOk = await verifyCheckboxCaptcha(captchaToken);
  if (!captchaOk) return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid email or password.' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

  const passwordAgeDays = (Date.now() - new Date(user.password_set_at).getTime()) / (1000 * 60 * 60 * 24);
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '12h' });

  const { rows: access } = await pool.query('SELECT module, can_edit FROM user_module_access WHERE user_id = $1', [user.id]);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    moduleAccess: access,
    passwordExpiringSoon: passwordAgeDays > 165, // warn in the last ~2 weeks of the 180-day window
  });
});

// POST /api/auth/forgot-password  (email-only flow, per spec)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1 AND is_active = true', [email?.toLowerCase()]);
  const user = rows[0];

  // Always respond the same way whether or not the email exists — don't leak which emails are registered.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [user.id, tokenHash]
    );
    const resetLink = `${process.env.APP_BASE_URL}/reset-password?token=${rawToken}&uid=${user.id}`;
    await sendMail({
      to: email,
      subject: 'Reset your password — Order Management ERP',
      text: `Click this link to reset your password (valid 1 hour): ${resetLink}`,
    });
  }

  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

// POST /api/auth/reset-password  (requires text captcha, per spec)
router.post('/reset-password', async (req, res) => {
  const { uid, token, newPassword, challengeToken, captchaAnswer } = req.body;

  if (!verifyTextCaptcha(challengeToken, captchaAnswer)) {
    return res.status(400).json({ error: 'Captcha answer incorrect.' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token || '').digest('hex');
  const { rows } = await pool.query(
    `SELECT * FROM password_reset_tokens
     WHERE user_id = $1 AND token_hash = $2 AND used_at IS NULL AND expires_at > now()`,
    [uid, tokenHash]
  );
  if (rows.length === 0) return res.status(400).json({ error: 'Reset link is invalid or has expired.' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = $1, password_set_at = now() WHERE id = $2', [passwordHash, uid]);
  await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [rows[0].id]);

  res.json({ message: 'Password updated. You can now log in.' });
});

module.exports = router;
