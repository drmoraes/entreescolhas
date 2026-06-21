// GET  /api/rh_wallet            — saldo + extrato + desbloqueados
// POST /api/rh_wallet (buy)      — compra de pacote de créditos
//   Em produção a compra é confirmada pelo webhook do Mercado Pago.
//   Sem MP_ACCESS_TOKEN configurado, credita direto (modo desenvolvimento).
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { requireCompany, getBalance, logAccess } = require('./_lib/b2b-auth');
const { getClientIp } = require('./_lib/rate-limit');
const { genToken } = require('./_lib/tokens');
const { can } = require('./_lib/perms');

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
    if (!can(ctx.role, 'buy')) return err(res, 'Seu perfil não tem permissão para comprar créditos.', 403);
    const body = getJsonBody(req) || {};
    const pkg = PACKAGES[body.package];
    if (!pkg) return err(res, 'Pacote inválido');

    // ── Cupom (opcional) ──
    let coupon = null, finalPrice = pkg.price, finalCredits = pkg.credits, discount = 0;
    if (body.coupon) {
      const cr = await query('SELECT * FROM coupons WHERE LOWER(code) = LOWER($1)', [String(body.coupon).trim()]);
      const cp = cr.rows[0];
      if (!cp || cp.status !== 'ativo') return err(res, 'Cupom inválido ou inativo');
      if (cp.valid_until && new Date(cp.valid_until) < new Date()) return err(res, 'Cupom expirado');
      if (cp.max_uses != null && cp.uses >= cp.max_uses) return err(res, 'Cupom esgotado');
      coupon = cp;
      if (cp.tipo === 'percent') { discount = +(pkg.price * Number(cp.valor) / 100).toFixed(2); finalPrice = +(pkg.price - discount).toFixed(2); }
      else { finalCredits = pkg.credits + Math.round(Number(cp.valor)); }
    }
    const registraResgate = async (orderId) => {
      if (!coupon) return;
      await query('UPDATE coupons SET uses = uses + 1 WHERE id = $1', [coupon.id]);
      await query(
        `INSERT INTO coupon_redemptions (coupon_id, company_id, order_id, discount, credits_granted)
         VALUES ($1,$2,$3,$4,$5)`,
        [coupon.id, ctx.company_id, orderId || null, discount, finalCredits - pkg.credits]);
    };
    const gratis = finalPrice < 1; // 100% off / cortesia total → credita direto

    // Com gateway configurado e preço > 0 → cria pedido + preference do Mercado Pago.
    if (process.env.MP_ACCESS_TOKEN && !gratis) {
      const extRef = 'cred_' + genToken().slice(0, 40);
      const ord = await query(
        `INSERT INTO credit_orders (company_id, package, credits, price, external_reference, status, coupon_code, discount)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7) RETURNING id`,
        [ctx.company_id, body.package, finalCredits, finalPrice, extRef, coupon ? coupon.code : null, discount]
      );
      const orderId = ord.rows[0].id;
      const base = process.env.APP_BASE_URL || '';
      const back = `${base}/portal-rh.html?pay=`;
      const payload = {
        items: [{
          title: `Pacote de ${finalCredits} créditos — Banco de Talentos`,
          quantity: 1, currency_id: 'BRL', unit_price: Number(finalPrice),
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
      await registraResgate(orderId);
      await logAccess(ctx, null, 'purchase_init', body.package, getClientIp(req), { orderId, price: finalPrice, coupon: coupon ? coupon.code : null });
      return json(res, { pending: true, init_point: result.init_point, package: body.package, price: finalPrice, credits: finalCredits, discount });
    }

    const balance = await getBalance(ctx.company_id);
    const after = balance + finalCredits;
    const expires = new Date(Date.now() + 365 * 86400000); // avulso: 12 meses
    await query(
      `INSERT INTO credit_ledger (company_id, delta, reason, ref_type, balance_after, expires_at, meta)
       VALUES ($1,$2,'purchase','payment',$3,$4,$5)`,
      [ctx.company_id, finalCredits, after, expires, JSON.stringify({ package: body.package, price: finalPrice, coupon: coupon ? coupon.code : null, dev: !process.env.MP_ACCESS_TOKEN })]
    );
    await registraResgate(null);
    await logAccess(ctx, null, 'purchase', body.package, getClientIp(req), { credits: finalCredits, coupon: coupon ? coupon.code : null });
    return json(res, { ok: true, credited: finalCredits, balance: after, discount });
  }

  return err(res, 'Method not allowed', 405);
};
