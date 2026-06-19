// GET  /api/rh_wallet            — saldo + extrato + desbloqueados
// POST /api/rh_wallet (buy)      — compra de pacote de créditos
//   Em produção a compra é confirmada pelo webhook do Mercado Pago.
//   Sem MP_ACCESS_TOKEN configurado, credita direto (modo desenvolvimento).
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { requireCompany, getBalance, logAccess } = require('./_lib/b2b-auth');
const { getClientIp } = require('./_lib/rate-limit');

const PACKAGES = {
  p10: { credits: 10, price: 290 },
  p25: { credits: 25, price: 650 },
  p50: { credits: 50, price: 1150 },
};

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  const ctx = await requireCompany(req, res);
  if (!ctx) return;

  if (req.method === 'GET') {
    const balance = await getBalance(ctx.company_id);
    const ledger = await query(
      `SELECT delta, reason, ref_type, ref_id, balance_after, meta, created_at, expires_at
         FROM credit_ledger WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [ctx.company_id]
    );
    const unlocked = await query(
      `SELECT u.id, u.status, u.adherence_score, u.confidence_score, u.invited_at,
              u.sla_deadline, u.responded_at, u.created_at, c.public_token, c.area, c.cargo
         FROM unlocks u JOIN candidates c ON c.id = u.candidate_id
        WHERE u.company_id = $1 ORDER BY u.created_at DESC LIMIT 100`,
      [ctx.company_id]
    );
    const agg = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status='responded')::int AS respondidos,
         COUNT(*) FILTER (WHERE status='refunded')::int AS estornados,
         COUNT(*) FILTER (WHERE status='active')::int AS aguardando
       FROM unlocks WHERE company_id = $1`,
      [ctx.company_id]
    );
    return json(res, {
      balance,
      stats: agg.rows[0],
      packages: PACKAGES,
      ledger: ledger.rows,
      unlocked: unlocked.rows,
    });
  }

  if (req.method === 'POST') {
    const body = getJsonBody(req) || {};
    const pkg = PACKAGES[body.package];
    if (!pkg) return err(res, 'Pacote inválido');

    // Sem gateway configurado → credita direto (dev). Com MP, criar preferência aqui.
    if (process.env.MP_ACCESS_TOKEN) {
      return json(res, {
        pending: true,
        message: 'Redirecionar para o checkout do Mercado Pago (a confirmação credita via webhook).',
        package: body.package, price: pkg.price,
      });
    }

    const balance = await getBalance(ctx.company_id);
    const after = balance + pkg.credits;
    const expires = new Date(Date.now() + 365 * 86400000); // avulso: 12 meses
    await query(
      `INSERT INTO credit_ledger (company_id, delta, reason, ref_type, balance_after, expires_at, meta)
       VALUES ($1,$2,'purchase','payment',$3,$4,$5)`,
      [ctx.company_id, pkg.credits, after, expires, JSON.stringify({ package: body.package, price: pkg.price, dev: true })]
    );
    await logAccess(ctx, null, 'purchase', body.package, getClientIp(req), { credits: pkg.credits });
    return json(res, { ok: true, credited: pkg.credits, balance: after });
  }

  return err(res, 'Method not allowed', 405);
};
