// Portal do Candidato (autoatendimento) — identificação por token PRIVADO (confirm_token),
// distinto do public_token (pseudônimo exposto ao RH).
// GET  /api/cand_portal?token=...                  → estado do próprio perfil
// POST /api/cand_portal?action=reconfirm           → confirma interesse ativo (renova selo Ativo)
// POST /api/cand_portal?action=visibility {value}  → visible | anonymous | hidden
// POST /api/cand_portal?action=consent {value:bool}→ consentimento de participação B2B
// POST /api/cand_portal?action=respond             → registra resposta a um convite (satisfaz SLA)
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { confidenceScore, thermalState } = require('./_lib/scoring');
const { checkRateLimit } = require('./_lib/rate-limit');

const VISIBILITIES = ['visible', 'anonymous', 'hidden'];

async function loadByToken(token) {
  const { rows } = await query('SELECT * FROM candidates WHERE confirm_token = $1', [token]);
  return rows[0] || null;
}

function publicState(c) {
  const conf = confidenceScore(c);
  return {
    nome: c.nome,
    area: c.area, cargo: c.cargo, senioridade: c.senioridade, cidade: c.cidade,
    visibility: c.visibility,
    b2b_consent: c.b2b_consent,
    email_verified: c.email_verified,
    phone_verified: c.phone_verified,
    last_confirmed_at: c.last_confirmed_at,
    confidence: conf.score,
    confidence_reasons: conf.reasons,
    thermal: thermalState(c),
    active: conf.active,
  };
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;

  const token = String((req.query && req.query.token) || (getJsonBody(req) || {}).token || '').trim();
  if (!token) return err(res, 'token obrigatório');

  // ── GET estado ─────────────────────────────────────────────
  if (req.method === 'GET') {
    const c = await loadByToken(token);
    if (!c) return err(res, 'Perfil não encontrado', 404);

    // o que fica oculto ao RH antes do desbloqueio
    const hidden_before_unlock = ['Nome', 'E-mail', 'Telefone', 'LinkedIn', 'Empresa atual', 'Cidade exata'];

    // convites pendentes (sem expor a empresa antes da resposta)
    const inv = await query(
      `SELECT u.id, u.invited_at, u.sla_deadline, u.status
         FROM unlocks u WHERE u.candidate_id = $1 AND u.invited_at IS NOT NULL
        ORDER BY u.invited_at DESC LIMIT 10`,
      [c.id]
    );
    return json(res, { profile: publicState(c), hidden_before_unlock, convites: inv.rows });
  }

  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const rl = await checkRateLimit(req, 'cand_portal', 30);
  if (!rl.ok) return err(res, 'Muitas tentativas. Tente novamente em uma hora.', 429);

  const c = await loadByToken(token);
  if (!c) return err(res, 'Perfil não encontrado', 404);
  const action = (req.query && req.query.action) || '';
  const body = getJsonBody(req) || {};

  // ── Reconfirmar interesse ──────────────────────────────────
  if (action === 'reconfirm') {
    // renova selo Ativo e devolve à busca padrão se estava rebaixado
    await query(
      `UPDATE candidates SET last_confirmed_at = NOW(),
              visibility = CASE WHEN visibility = 'hidden' THEN 'hidden' ELSE 'visible' END
        WHERE id = $1`,
      [c.id]
    );
    const updated = await loadByToken(token);
    return json(res, { ok: true, message: 'Interesse confirmado. Selo "Ativo" renovado.', profile: publicState(updated) });
  }

  // ── Controle de visibilidade ───────────────────────────────
  if (action === 'visibility') {
    const v = String(body.value || '').trim();
    if (!VISIBILITIES.includes(v)) return err(res, 'Visibilidade inválida');
    await query('UPDATE candidates SET visibility = $1 WHERE id = $2', [v, c.id]);
    return json(res, { ok: true, visibility: v });
  }

  // ── Consentimento B2B (e revogação) ────────────────────────
  if (action === 'consent') {
    const on = body.value === true || body.value === 'true';
    await query(
      `UPDATE candidates SET b2b_consent = $1, b2b_consent_at = NOW(),
              visibility = CASE WHEN $1 THEN visibility ELSE 'hidden' END
        WHERE id = $2`,
      [on, c.id]
    );
    return json(res, {
      ok: true, b2b_consent: on,
      message: on ? 'Você entrou no Banco de Talentos.' : 'Consentimento revogado. Seu perfil saiu da base em tempo real.',
    });
  }

  // ── Registrar resposta a um convite (satisfaz o SLA) ───────
  if (action === 'respond') {
    const upd = await query(
      `UPDATE unlocks SET status='responded', responded_at=NOW()
        WHERE candidate_id = $1 AND status='active' AND invited_at IS NOT NULL
      RETURNING id`,
      [c.id]
    );
    if (upd.rowCount > 0) {
      await query('UPDATE candidates SET responses_received = COALESCE(responses_received,0) + 1 WHERE id = $1', [c.id]);
    }
    return json(res, { ok: true, respondidos: upd.rowCount,
      message: upd.rowCount ? 'Resposta registrada. A empresa foi notificada.' : 'Nenhum convite ativo no momento.' });
  }

  return err(res, 'Ação inválida');
};
