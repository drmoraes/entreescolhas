// GET /api/rh_candidate?token=XXXX  — perfil ANÔNIMO detalhado (com breakdown dos scores)
// Se a empresa já desbloqueou, devolve também os dados reais (reveal).
const { setCors, json, err } = require('./_lib/http');
const { query } = require('./_lib/db');
const { requireCompany, logAccess } = require('./_lib/b2b-auth');
const { anonymizeCandidate, revealCandidate } = require('./_lib/anonymize');
const { getClientIp } = require('./_lib/rate-limit');
const { costForCandidate } = require('./_lib/credits');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const ctx = await requireCompany(req, res);
  if (!ctx) return;

  const token = String((req.query && req.query.token) || '').trim();
  if (!token) return err(res, 'token obrigatório');

  const { rows } = await query('SELECT * FROM candidates WHERE public_token = $1', [token]);
  const c = rows[0];
  if (!c) return err(res, 'Candidato não encontrado', 404);
  if (c.visibility === 'hidden' || !c.b2b_consent) return err(res, 'Perfil indisponível', 403);

  const criteria = {
    skills: req.query.skills ? String(req.query.skills).split(',').map((s) => s.trim()) : [],
    setor: req.query.setor || null,
    senioridade: req.query.senioridade || null,
    work_model: req.query.work_model || null,
    cidade: req.query.cidade || null,
    salary_max: req.query.salary_max ? Number(req.query.salary_max) : null,
  };

  const dto = anonymizeCandidate(c, criteria);
  const ci = await costForCandidate(c);
  dto.credit_cost = ci.cost;
  dto.categoria_efetiva = ci.categoria;

  // já desbloqueado por esta empresa?
  const un = await query(
    'SELECT * FROM unlocks WHERE company_id = $1 AND candidate_id = $2',
    [ctx.company_id, c.id]
  );
  const unlock = un.rows[0];
  dto.unlocked = !!unlock;

  if (unlock) {
    dto.revealed = revealCandidate(c);
    dto.unlock = {
      status: unlock.status, invited_at: unlock.invited_at,
      sla_deadline: unlock.sla_deadline, responded_at: unlock.responded_at,
    };
    await logAccess(ctx, c.id, 'view_revealed', token, getClientIp(req));
  } else {
    await logAccess(ctx, c.id, 'view_anon', token, getClientIp(req));
  }

  return json(res, dto);
};
