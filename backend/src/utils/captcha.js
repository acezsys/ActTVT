const fetch = global.fetch; // Node 18+ has fetch built in

// Checkbox captcha (Google reCAPTCHA v2 "I'm not a robot") — used on every login.
// Requires RECAPTCHA_SECRET_KEY in .env (free — one-time signup at google.com/recaptcha).
async function verifyCheckboxCaptcha(token) {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    // Fail safe in local/dev if not configured yet, but never in production.
    if (process.env.NODE_ENV === 'production') return false;
    console.warn('RECAPTCHA_SECRET_KEY not set — skipping captcha check (dev mode only).');
    return true;
  }
  if (!token) return false;

  const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
  });
  const data = await resp.json();
  return data.success === true;
}

// Text-based captcha for sensitive actions (password reset, user deletion, etc).
// Simple server-generated challenge stored in a short-lived signed token, no third party needed.
const jwt = require('jsonwebtoken');

function generateTextCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const challengeToken = jwt.sign({ answer: a + b }, process.env.JWT_SECRET, { expiresIn: '5m' });
  return { question: `What is ${a} + ${b}?`, challengeToken };
}

function verifyTextCaptcha(challengeToken, userAnswer) {
  try {
    const payload = jwt.verify(challengeToken, process.env.JWT_SECRET);
    return Number(userAnswer) === payload.answer;
  } catch {
    return false;
  }
}

module.exports = { verifyCheckboxCaptcha, generateTextCaptcha, verifyTextCaptcha };
