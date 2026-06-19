// POST /api/rh_invite — { token, message } envia convite ao candidato e inicia o SLA (7 dias).
// Dispara e-mail real (Nodemailer) e devolve um link wa.me (gancho de WhatsApp).
// Sem convite, não há SLA → não há reembolso por "sem resposta" (anti-abuso).
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { requireCompany, logAccess } = require('./_lib/b2b-auth');
const { getClientIp } = require('./_lib/rate-limit');
const mailer = require('./_lib/mailer');
const { buildInviteEmailHtml } = require('./_lib/invite-email');

const SLA_DAYS = 7;

// Link wa.me para o RH abrir uma conversa com o candidato (já desbloqueado).
function whatsappLink(telefone, nome) {
  const digits = String(telefone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const intl = digits.startsWith('55') ? digits : '55' + digits;
  const txt = encodeURIComponent(`Olá, ${nome || ''}! Encontramos seu perfil no Banco de Talentos do Entre Escolhas e gostaríamos de conversar sobre uma oportunidade.`);
  return `https://wa.me/${intl}?text=${txt}`;
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const ctx = await requireCompany(req, res);
  if (!ctx) return;

  const body = getJsonBody(req) || {};
  const token = String(body.token || '').trim();
  const message = String(body.message || '').trim().slice(0, 2000);
  if (!token) return err(res, 'token obrigatório');

  const cRes = await query(
    'SELECT id, nome, email, telefone, confirm_token FROM candidates WHERE public_token = $1', [token]
  );
  const c = cRes.rows[0];
  if (!c) return err(res, 'Candidato não encontrado', 404);

  const unRes = await query(
    'SELECT * FROM unlocks WHERE company_id = $1 AND candidate_id = $2', [ctx.company_id, c.id]
  );
  const unlock = unRes.rows[0];
  if (!unlock) return err(res, 'Desbloqueie o candidato antes de convidar', 403);
  if (unlock.status === 'refunded') return err(res, 'Este desbloqueio foi estornado', 409);
  if (unlock.invited_at) return err(res, 'Convite já enviado para este candidato', 409);

  const deadline = new Date(Date.now() + SLA_DAYS * 86400000);
  await query(
    "UPDATE unlocks SET invited_at = NOW(), sla_deadline = $1, status = 'active' WHERE id = $2",
    [deadline, unlock.id]
  );
  await query('UPDATE candidates SET invites_total = COALESCE(invites_total,0) + 1 WHERE id = $1', [c.id]);

  // ── Envio real do e-mail ───────────────────────────────────
  let emailSent = false;
  const base = process.env.APP_BASE_URL || '';
  const link = `${base}/meu-perfil.html?token=${encodeURIComponent(c.confirm_token || '')}`;
  if (c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
    const html = buildInviteEmailHtml(c.nome, message, link, SLA_DAYS);
    emailSent = await mailer.send(c.email, 'Uma empresa quer falar com você — Entre Escolhas', html);
    if (!emailSent) console.error('rh_invite: falha no e-mail —', mailer.getLastError());
  }

  await logAccess(ctx, c.id, 'invite', `sla ${SLA_DAYS}d`, getClientIp(req), { unlockId: unlock.id, emailSent });

  return json(res, {
    ok: true,
    sla_deadline: deadline,
    email_sent: emailSent,
    whatsapp_url: whatsappLink(c.telefone, c.nome), // gancho: o portal abre o wa.me
    message: emailSent
      ? `Convite enviado por e-mail. O candidato tem ${SLA_DAYS} dias para responder; sem resposta, o crédito é estornado automaticamente.`
      : `Convite registrado (SLA ${SLA_DAYS} dias). O e-mail não pôde ser enviado agora — use o WhatsApp ou tente novamente.`,
  });
};
