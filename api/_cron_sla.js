// GET/POST /api/cron_sla — varredura de SLA (rodar via Vercel Cron ou com ADMIN_API_KEY).
// 1) Desbloqueios 'active' com SLA vencido e sem resposta → estorno automático (sem-resposta).
// 2) Candidatos frios (>90d sem confirmar) → ocultados da busca padrão.
const { setCors, json, err, requireApiKey } = require('./_lib/http');
const { getDB, query } = require('./_lib/db');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  // permite cron interno da Vercel (header) ou chamada com ADMIN_API_KEY
  const isCron = req.headers['x-vercel-cron'] || req.headers['x-vercel-signature'];
  if (!isCron && !(await requireApiKey(req, res))) return;

  let refunded = 0, hidden = 0;
  const client = await getDB().connect();
  try {
    // ── 1) SLA vencido → estorno por "sem resposta" ──────────
    const due = await query(
      `SELECT id, company_id, candidate_id, credits_spent
         FROM unlocks
        WHERE status = 'active' AND invited_at IS NOT NULL
          AND sla_deadline < NOW() AND responded_at IS NULL`
    );
    for (const u of due.rows) {
      try {
        await client.query('BEGIN');
        const balRes = await client.query(
          'SELECT COALESCE(SUM(delta),0)::int AS s FROM credit_ledger WHERE company_id = $1', [u.company_id]
        );
        const after = balRes.rows[0].s + u.credits_spent;
        await client.query(
          `INSERT INTO credit_ledger (company_id, delta, reason, ref_type, ref_id, balance_after, meta)
           VALUES ($1,$2,'refund_auto','unlock',$3,$4,$5)`,
          [u.company_id, u.credits_spent, u.id, after, JSON.stringify({ motivo: 'sem_resposta_sla' })]
        );
        await client.query("UPDATE unlocks SET status='refunded', refunded_at=NOW() WHERE id=$1", [u.id]);
        await client.query(
          `INSERT INTO access_logs (company_id, candidate_id, action, purpose, meta)
           VALUES ($1,$2,'refund_auto','sla_sem_resposta',$3)`,
          [u.company_id, u.candidate_id, JSON.stringify({ unlockId: u.id })]
        );
        await client.query('COMMIT');
        refunded++;
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) {}
      }
    }

    // ── 2) Ocultar perfis frios da busca padrão ──────────────
    const h = await query(
      `UPDATE candidates SET visibility = 'anonymous'
        WHERE visibility = 'visible'
          AND (last_confirmed_at IS NULL OR last_confirmed_at < NOW() - INTERVAL '90 days')
      RETURNING id`
    );
    hidden = h.rowCount;

    // ── 3) Liberar comissões de afiliado cuja janela CDC (8 dias) venceu sem estorno ──
    let released = 0;
    try {
      const rel = await query(
        `UPDATE affiliate_commissions
            SET status='released', released_at=NOW()
          WHERE status='pending' AND release_at <= NOW()
        RETURNING id`);
      released = rel.rowCount;
    } catch (e) { /* tabela pode não existir antes da migração */ }

    return json(res, { ok: true, refunded_sla: refunded, cold_demoted: hidden, commissions_released: released });
  } catch (e) {
    return err(res, 'cron falhou: ' + e.message, 500);
  } finally {
    client.release();
  }
};
