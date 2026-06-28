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
  let accessToken;

  // Auto-confirmação: a pessoa entra direto no teste, sem esperar clicar no
  // e-mail. O e-mail de confirmação ainda é enviado (serve de comprovante e
  // de link de recuperação de acesso), mas não bloqueia mais o início do teste.
  if (existing) {
    accessToken = existing.access_token;
    jaConfirmado = !!existing.confirmed_at;
    await query(
      'UPDATE leads SET nome = $1, confirm_token = $2, ip = $3, confirmed_at = COALESCE(confirmed_at, NOW()), updated_at = NOW() WHERE id = $4',
      [nome, confirmToken, ip, existing.id]
    );
  } else {
    accessToken = genToken();
    await query(
      `INSERT INTO leads (nome, email, jornada, confirm_token, access_token, ip, confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
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
    subject = 'Seu acesso ao Entre Escolhas';
    html = `
      <p>Olá, ${escapeHtml(nome)}!</p>
      <p>Seu acesso já está liberado — você já pode estar com o teste aberto em outra aba.</p>
      <p>Guarde este e-mail: ele também serve como link de acesso/recuperação, caso precise continuar depois:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Se você não pediu este e-mail, pode ignorá-lo.</p>
    `;
  }

  // O envio do e-mail é best-effort: o acesso ao teste já foi liberado acima
  // (auto-confirmado), então uma falha de e-mail não pode mais bloquear a
  // pessoa de começar — só perde o comprovante/link de recuperação por e-mail.
  const sent = await mailer.send(email, subject, html);
  if (!sent) {
    console.error('lead_register: falha ao enviar e-mail (não bloqueante) —', mailer.getLastError());
  }

  json(res, { ok: true, access_token: accessToken });
};
