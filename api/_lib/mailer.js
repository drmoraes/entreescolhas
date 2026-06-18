// Porte do antigo Mailer.php (socket SMTP cru) para nodemailer.
const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    const secure = (process.env.SMTP_SECURE || 'tls') === 'ssl';
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure, // true = SSL direto (465), false = STARTTLS (587)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// Mantém a mesma assinatura usada nos endpoints PHP: send(to, subject, html) -> boolean
async function send(to, subject, html) {
  try {
    const fromName = process.env.SMTP_FROM_NAME || 'Entre Escolhas';
    await getTransporter().sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (e) {
    lastError = e.message || String(e);
    return false;
  }
}

let lastError = '';
function getLastError() {
  return lastError;
}

module.exports = { send, getLastError };
