// POST /api/lead_register — cadastro (nome+email) antes do teste.
// Sempre responde de forma genérica (não revela se o e-mail já existe).
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const mailer = require('./_lib/mailer');
const { genToken } = require('./_lib/tokens');
const { checkRateLimit, getClientIp } = require('./_lib/rate-limit');

const ALLOWED_JORNADAS = ['arquetipo', 'fit-cultural', 'scanner', 'bussola'];

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req);
  if (!data) return err(res, 'Invalid JSON');

  const nome = String(data.nome ?? '').trim();
  const email = String(data.email ?? '').toLowerCase().trim();
  const jornada = String(data.jornada ?? '').trim();

  if (nome.length < 2) return err(res, 'Nome obrigatório');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');
  if (!ALLOWED_JORNADAS.includes(jornada)) return err(res, 'Jornada inválida');

  const rl = await checkRateLimit(req, 'lead_register', 10);
  if (!rl.ok) return err(res, 'Muitas tentativas. Tente novamente em uma hora.', 429);
  const ip = rl.ip;

  const confirmToken = genToken();

  // Indicação (programa de afiliados): valida o código e veta autoindicação.
  // Tudo best-effort — nunca pode quebrar o cadastro (ex.: antes da migração).
  let refCode = String(data.ref ?? '').trim().toUpperCase().slice(0, 20) || null;
  if (refCode) {
    try {
      const { rows: rc } = await query(
        'SELECT owner_email FROM referral_codes WHERE code = $1', [refCode]);
      if (!rc[0] || rc[0].owner_email === email) refCode = null; // inexistente ou autoindicação
    } catch (e) { refCode = null; /* tabela pode não existir ainda */ }
  }

  const { rows } = await query(
    'SELECT id, access_token, confirmed_at FROM leads WHERE email = $1 AND jornada = $2',
    [email, jornada]
  );
  const existing = rows[0];
  let jaConfirmado = false;

  if (existing) {
    await query(
      'UPDATE leads SET nome = $1, confirm_token = $2, ip = $3, updated_at = NOW() WHERE id = $4',
      [nome, confirmToken, ip, existing.id]
    );
    jaConfirmado = !!existing.confirmed_at;
  } else {
    const accessToken = genToken();
    await query(
      `INSERT INTO leads (nome, email, jornada, confirm_token, access_token, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nome, email, jornada, confirmToken, accessToken, ip]
    );
  }

  // Atribuição da indicação (first-touch) — separada e tolerante a falhas.
  if (refCode) {
    try {
      await query(
        `UPDATE leads SET referred_by_code = $1
           WHERE email = $2 AND jornada = $3 AND referred_by_code IS NULL`,
        [refCode, email, jornada]);
    } catch (e) { /* coluna pode não existir antes da migração */ }
  }

  const link = `${process.env.APP_BASE_URL}/api/lead_confirm?token=${confirmToken}`;

  let subject, html;
  if (jaConfirmado) {
    subject = 'Seu link de acesso — Entre Escolhas';
    html = `
      <p>Olá, ${escapeHtml(nome)}!</p>
      <p>Aqui está o seu link de acesso ao teste/relatório do Entre Escolhas:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não pediu este e-mail, pode ignorá-lo.</p>
    `;
  } else {
    subject = 'Confirme seu e-mail — Entre Escolhas';
    html = `
      <p>Olá, ${escapeHtml(nome)}!</p>
      <p>Falta só um passo para começar sua análise gratuita no Entre Escolhas. Confirme seu e-mail clicando no link abaixo:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não pediu este e-mail, pode ignorá-lo.</p>
    `;
  }

  const sent = await mailer.send(email, subject, html);
  if (!sent) {
    console.error('lead_register: falha ao enviar e-mail —', mailer.getLastError());
    return err(res, 'Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.', 502);
  }

  json(res, { ok: true });
};
