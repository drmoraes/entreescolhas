// POST /api/rh_unlock — { token } gasta 1 crédito e revela o candidato.
// Fluxo: valida saldo → valida contato (técnico) → debita → cria unlock →
// se contato inválido, estorna automaticamente (antifrustração). Tudo transacional + logado.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { getDB, query } = require('./_lib/db');
const { requireCompany, logAccess } = require('./_lib/b2b-auth');
const { can } = require('./_lib/perms');
const { revealCandidate, validateContact } = require('./_lib/anonymize');
const { confidenceScore, adherenceScore } = require('./_lib/scoring');
const { getClientIp } = require('./_lib/rate-limit');
const { creditCostFor } = require('./_lib/credits');
const { getCreditCosts } = require('./_lib/settings');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const ctx = await requireCompany(req, res);
  if (!ctx) return;
  if (!can(ctx.role, 'unlock')) return err(res, 'Seu perfil não tem permissão para desbloquear candidatos.', 403);

  const body = getJsonBody(req) || {};
  const token = String(body.token || '').trim();
  if (!token) return err(res, 'token obrigatório');

  const criteria = body.criteria || {};
  const ip = getClientIp(req);

  const client = await getDB().connect();
  try {
    await client.query('BEGIN');

    const cRes = await client.query('SELECT * FROM candidates WHERE public_token = $1 FOR UPDATE', [token]);
    const c = cRes.rows[0];
    if (!c) { await client.query('ROLLBACK'); return err(res, 'Candidato não encontrado', 404); }
    if (c.visibility === 'hidden' || !c.b2b_consent) {
      await client.query('ROLLBACK'); return err(res, 'Perfil indisponível para desbloqueio', 403);
    }

    // já desbloqueado?
    const dup = await client.query(
      'SELECT id FROM unlocks WHERE company_id = $1 AND candidate_id = $2',
      [ctx.company_id, c.id]
    );
    if (dup.rows[0]) {
      await client.query('ROLLBACK');
      return err(res, 'Você já desbloqueou este candidato', 409);
    }

    // custo do desbloqueio por categoria do candidato (operacional/analista/
    // especialista/gerencial) ou PCD — parametrizável no admin.
    const costInfo = creditCostFor(c, await getCreditCosts());
    const UNLOCK_COST = costInfo.cost;

    // saldo
    const balRes = await client.query(
      'SELECT COALESCE(SUM(delta),0)::int AS s FROM credit_ledger WHERE company_id = $1', [ctx.company_id]
    );
    const balance = balRes.rows[0].s;
    if (balance < UNLOCK_COST) {
      await client.query('ROLLBACK');
      return err(res, `Saldo insuficiente: este perfil custa ${UNLOCK_COST} crédito(s) e você tem ${balance}.`, 402);
    }

    // scores persistidos no desbloqueio
    const adh = adherenceScore(c, criteria).score;
    const conf = confidenceScore(c).score;

    // validação técnica de contato
    const contact = validateContact(c);

    // debita 1 crédito
    const afterDebit = balance - UNLOCK_COST;
    await client.query(
      `INSERT INTO credit_ledger (company_id, delta, reason, ref_type, balance_after, meta)
       VALUES ($1,$2,'unlock','candidate',$3,$4)`,
      [ctx.company_id, -UNLOCK_COST, afterDebit, JSON.stringify({ token, categoria: costInfo.categoria, custo: UNLOCK_COST })]
    );

    // cria unlock
    const unRes = await client.query(
      `INSERT INTO unlocks (company_id, company_user_id, candidate_id, credits_spent, status,
                            contact_valid, adherence_score, confidence_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [ctx.company_id, ctx.user_id, c.id, UNLOCK_COST,
       contact.valid ? 'active' : 'refunded', contact.valid, adh, conf]
    );
    const unlockId = unRes.rows[0].id;
    await client.query('UPDATE credit_ledger SET ref_id = $1 WHERE company_id = $2 AND ref_type=$3 AND ref_id IS NULL',
      [unlockId, ctx.company_id, 'candidate']);

    // ── ANTIFRUSTRAÇÃO: contato inválido → estorno automático ──
    if (!contact.valid) {
      const afterRefund = afterDebit + UNLOCK_COST;
      await client.query(
        `INSERT INTO credit_ledger (company_id, delta, reason, ref_type, ref_id, balance_after, meta)
         VALUES ($1,$2,'refund_auto','unlock',$3,$4,$5)`,
        [ctx.company_id, UNLOCK_COST, unlockId, afterRefund, JSON.stringify({ motivo: 'contato_invalido' })]
      );
      await client.query('UPDATE unlocks SET refunded_at = NOW() WHERE id = $1', [unlockId]);
      // tira o perfil da base ativa (contato quebrado)
      await client.query("UPDATE candidates SET visibility = 'hidden' WHERE id = $1", [c.id]);
      await client.query('COMMIT');

      await logAccess(ctx, c.id, 'unlock', 'contato_invalido_estornado', ip, { unlockId });
      return json(res, {
        unlocked: false, refunded: true, balance: afterRefund,
        message: 'Contato inválido detectado. Crédito estornado automaticamente.',
      });
    }

    await client.query('COMMIT');

    // log de revelação de PII (fora da transação)
    await logAccess(ctx, c.id, 'reveal_pii', 'desbloqueio', ip, { unlockId, adh, conf });

    return json(res, {
      unlocked: true, refunded: false, balance: afterDebit, credits_spent: UNLOCK_COST,
      categoria: costInfo.categoria,
      unlock: { id: unlockId, status: 'active', adherence: adh, confidence: conf },
      candidate: revealCandidate(c),
      message: `Candidato desbloqueado (${UNLOCK_COST} crédito(s)). Envie um convite para iniciar a janela de resposta (SLA 7 dias).`,
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    return err(res, 'Falha no desbloqueio: ' + e.message, 500);
  } finally {
    client.release();
  }
};
