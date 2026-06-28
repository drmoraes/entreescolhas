// POST /api/rh_dispute — { token, reason, notes } abre disputa de reembolso.
// Resolve automaticamente os casos elegíveis; demais entram em análise (SLA 48h).
// Anti-abuso: limite por janela + reputação da empresa.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { getDB, query } = require('./_lib/db');
const { requireCompany, logAccess } = require('./_lib/b2b-auth');
const { getClientIp } = require('./_lib/rate-limit');

const REASONS = ['outdated', 'not_eligible', 'quality'];
const AUTO_REFUND = { not_eligible: 'refund_full', outdated: 'refund_full' }; // quality → manual
const DISPUTE_WINDOW_DAYS = 7;
const MAX_DISPUTES_30D = 15;

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const ctx = await requireCompany(req, res);
  if (!ctx) return;

  const body = getJsonBody(req) || {};
  const token = String(body.token || '').trim();
  const reason = String(body.reason || '').trim();
  const notes = String(body.notes || '').trim().slice(0, 1000);
  if (!token) return err(res, 'token obrigatório');
  if (!REASONS.includes(reason)) return err(res, 'Motivo inválido');

  const cRes = await query('SELECT id FROM candidates WHERE public_token = $1', [token]);
  const c = cRes.rows[0];
  if (!c) return err(res, 'Candidato não encontrado', 404);

  const unRes = await query(
    'SELECT * FROM unlocks WHERE company_id = $1 AND candidate_id = $2', [ctx.company_id, c.id]
  );
  const unlock = unRes.rows[0];
  if (!unlock) return err(res, 'Desbloqueio não encontrado', 404);
  if (unlock.status === 'refunded') return err(res, 'Este desbloqueio já foi estornado', 409);

  // janela de disputa
  const ageDays = (Date.now() - new Date(unlock.created_at).getTime()) / 86400000;
  if (ageDays > DISPUTE_WINDOW_DAYS && reason !== 'quality') {
    return err(res, `Fora da janela de ${DISPUTE_WINDOW_DAYS} dias para reembolso automático`, 422);
  }

  // anti-abuso: volume recente + reputação
  const recent = await query(
    "SELECT COUNT(*)::int AS n FROM disputes WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '30 days'",
    [ctx.company_id]
  );
  const tooMany = recent.rows[0].n >= MAX_DISPUTES_30D || ctx.reputation < 50;
  const autoRes = AUTO_REFUND[reason];
  const willAuto = autoRes && !tooMany;

  const client = await getDB().connect();
  try {
    await client.query('BEGIN');

    // mesma trava usada em rh_unlock: serializa leituras/escritas do saldo desta empresa.
    await client.query('SELECT id FROM companies WHERE id = $1 FOR UPDATE', [ctx.company_id]);

    const dRes = await client.query(
      `INSERT INTO disputes (unlock_id, company_id, reason, status, resolution, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [unlock.id, ctx.company_id, reason, willAuto ? 'approved' : 'open',
       willAuto ? autoRes : null, notes || null]
    );
    const disputeId = dRes.rows[0].id;

    let refunded = false, balance = null;
    if (willAuto) {
      const balRes = await client.query(
        'SELECT COALESCE(SUM(delta),0)::int AS s FROM credit_ledger WHERE company_id = $1', [ctx.company_id]
      );
      const after = balRes.rows[0].s + unlock.credits_spent;
      await client.query(
        `INSERT INTO credit_ledger (company_id, delta, reason, ref_type, ref_id, balance_after, meta)
         VALUES ($1,$2,'refund_manual','dispute',$3,$4,$5)`,
        [ctx.company_id, unlock.credits_spent, disputeId, after, JSON.stringify({ reason })]
      );
      await client.query(
        "UPDATE unlocks SET status = 'refunded', refunded_at = NOW() WHERE id = $1", [unlock.id]
      );
      await client.query('UPDATE disputes SET credits_returned = $1, resolved_at = NOW() WHERE id = $2',
        [unlock.credits_spent, disputeId]);
      // motivo "outdated" → candidato precisa reconfirmar dados
      if (reason === 'outdated') {
        await client.query('UPDATE candidates SET last_confirmed_at = NULL WHERE id = $1', [c.id]);
      }
      refunded = true; balance = after;
    }

    // pequena penalização de reputação por disputa (deter abuso)
    await client.query('UPDATE companies SET reputation = GREATEST(0, reputation - 1) WHERE id = $1', [ctx.company_id]);

    await client.query('COMMIT');
    await logAccess(ctx, c.id, 'dispute', reason, getClientIp(req), { disputeId, willAuto });

    return json(res, willAuto
      ? { ok: true, refunded, balance, message: 'Reembolso aprovado automaticamente. Crédito devolvido.' }
      : { ok: true, refunded: false, status: 'open', message: 'Disputa aberta. Análise em até 48h.' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    return err(res, 'Falha ao abrir disputa: ' + e.message, 500);
  } finally {
    client.release();
  }
};
