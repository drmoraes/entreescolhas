// GET  /api/rh_wallet            — saldo + extrato + desbloqueados
// POST /api/rh_wallet (buy)      — compra de pacote de créditos
//   Em produção a compra é confirmada pelo webhook do Mercado Pago.
//   Sem MP_ACCESS_TOKEN configurado, credita direto (modo desenvolvimento).
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { requireCompany, getBalance, logAccess } = require('./_lib/b2b-auth');
const { getClientIp } = require('./_lib/rate-limit');
const { genToken } = require('./_lib/tokens');

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

    // Com gateway configurado → cria pedido + preference do Mercado Pago.
    if (process.env.MP_ACCESS_TOKEN) {
      const extRef = 'cred_' + genToken().slice(0, 40);
      const ord = await query(
        `INSERT INTO credit_orders (company_id, package, credits, price, external_reference, status)
         VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
        [ctx.company_id, body.package, pkg.credits, pkg.price, extRef]
      );
      const orderId = ord.rows[0].id;
      const base = process.env.APP_BASE_URL || '';
      const back = `${base}/portal-rh.html?pay=`;
      const payload = {
        items: [{
          title: `Pacote de ${pkg.credits} créditos — Banco de Talentos`,
          quantity: 1, currency_id: 'BRL', unit_price: Number(pkg.price),
        }],
        payer: { email: ctx.user_email },
        external_reference: extRef,
        back_urls: { success: back + 'success', pending: back + 'pending', failure: back + 'failure' },
        auto_return: 'approved',
        notification_url: `${base}/api/b2b?fn=mp_webhook_credits`,
      };
      let response, result;
      try {
        response = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
          body: JSON.stringify(payload),
        });
        result = await response.json();
      } catch (e) {
        return err(res, 'Não foi possível iniciar o pagamento agora. Tente novamente.', 502);
      }
      if (!response.ok || !result.init_point) {
        return err(res, 'Não foi possível iniciar o pagamento agora. Tente novamente.', 502);
      }
      await query('UPDATE credit_orders SET mp_preference_id = $1 WHERE id = $2', [result.id || null, orderId]);
      await logAccess(ctx, null, 'purchase_init', body.package, getClientIp(req), { orderId, price: pkg.price });
      return json(res, { pending: true, init_point: result.init_point, package: body.package, price: pkg.price });
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
