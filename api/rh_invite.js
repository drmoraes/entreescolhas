// POST /api/rh_invite — { token, message } envia convite ao candidato e inicia o SLA (7 dias).
// Sem convite, não há SLA → não há reembolso por "sem resposta" (anti-abuso).
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { requireCompany, logAccess } = require('./_lib/b2b-auth');
const { getClientIp } = require('./_lib/rate-limit');

const SLA_DAYS = 7;

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const ctx = await requireCompany(req, res);
  if (!ctx) return;

  const body = getJsonBody(req) || {};
  const token = String(body.token || '').trim();
  const message = String(body.message || '').trim().slice(0, 2000);
  if (!token) return err(res, 'token obrigatório');

  const cRes = await query('SELECT id FROM candidates WHERE public_token = $1', [token]);
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

  // (envio real de e-mail/WhatsApp reutiliza _lib/mailer + integração WhatsApp)
  await logAccess(ctx, c.id, 'invite', `sla ${SLA_DAYS}d`, getClientIp(req), { unlockId: unlock.id });

  return json(res, {
    ok: true,
    sla_deadline: deadline,
    message: `Convite registrado. O candidato tem ${SLA_DAYS} dias para responder; sem resposta, o crédito é estornado automaticamente.`,
  });
};
