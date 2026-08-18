const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.warn(`[mailer] SMTP not configured — would have sent "${subject}" to ${to}`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.ALERT_FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail };
