// /api/b2b?fn=admin_cashback&op=... — painel do Programa de Afiliados (Admin).
//   op=list          → indicações/comissões recentes (quem indicou, %, status)
//   op=queue         → fila de saque: comissões liberadas e não pagas, por afiliado
//   op=mark_paid     → registra pagamento Pix de um afiliado (marca comissões 'paid')
//   op=release_now   → libera manualmente comissões com janela vencida
//   op=settings_get  → percentuais e parâmetros do programa
//   op=settings_set  → altera desconto/comissão/janela/mínimo/ativo
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { adminCan } = require('./_lib/admin-perms');
const { getSetting, setSetting } = require('./_lib/settings');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const op = String((req.query && req.query.op) || 'list');
  const role = (req.actor || {}).role;
  const canManage = adminCan(role, 'coupons'); // financeiro/owner

  // ── lista de comissões (visão geral) ────────────────────
  if (op === 'list') {
    try {
    const { rows } = await query(`
      SELECT c.id, c.referrer_code, c.referrer_email, c.referred_email,
             c.purchase_amount, c.commission_pct, c.commission_amount,
             c.status, c.paid_purchase_at, c.release_at, c.released_at,
             p.kind, p.payment_method
        FROM affiliate_commissions c
        JOIN purchases p ON p.id = c.purchase_id
       ORDER BY c.created_at DESC LIMIT 500`);
    const tot = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN status='pending'  THEN commission_amount END),0) AS pending,
        COALESCE(SUM(CASE WHEN status='released' THEN commission_amount END),0) AS released,
        COALESCE(SUM(CASE WHEN status='paid'     THEN commission_amount END),0) AS paid,
        COALESCE(SUM(CASE WHEN status='cancelled'THEN commission_amount END),0) AS cancelled
      FROM affiliate_commissions`);
    return json(res, {
      ok: true,
      totals: Object.fromEntries(Object.entries(tot.rows[0]).map(([k, v]) => [k, Number(v)])),
      data: rows.map(r => ({
        ...r,
        purchase_amount: Number(r.purchase_amount),
        commission_pct: Number(r.commission_pct),
        commission_amount: Number(r.commission_amount),
      })),
    });
    } catch (e) {
      if (/relation|does not exist|column/i.test(e.message)) {
        return json(res, { ok: true, needs_migration: true, totals: { pending: 0, released: 0, paid: 0, cancelled: 0 }, data: [] });
      }
      throw e;
    }
  }

  // ── fila de saque (liberadas, não pagas, agrupadas por afiliado) ─
  if (op === 'queue') {
    try {
    const { rows } = await query(`
      SELECT c.referrer_code, c.referrer_email,
             COUNT(*)::int AS itens,
             COALESCE(SUM(c.commission_amount),0) AS total,
             rc.owner_name, rc.cpf, rc.pix_key, rc.pix_key_type
        FROM affiliate_commissions c
        LEFT JOIN referral_codes rc ON rc.code = c.referrer_code
       WHERE c.status='released' AND c.payout_id IS NULL
       GROUP BY c.referrer_code, c.referrer_email, rc.owner_name, rc.cpf, rc.pix_key, rc.pix_key_type
       ORDER BY total DESC`);
    const minPayout = Number(await getSetting('cashback_min_payout', '20.00'));
    return json(res, {
      ok: true, min_payout: minPayout,
      data: rows.map(r => ({
        ...r, total: Number(r.total),
        tem_pix: !!r.pix_key,
        atinge_minimo: Number(r.total) >= minPayout,
      })),
    });
    } catch (e) {
      if (/relation|does not exist|column/i.test(e.message)) {
        return json(res, { ok: true, needs_migration: true, min_payout: 20, data: [] });
      }
      throw e;
    }
  }

  // ── registra pagamento Pix de um afiliado ───────────────
  if (op === 'mark_paid') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    if (!canManage) return err(res, 'Seu perfil não pode registrar pagamentos.', 403);
    const b = getJsonBody(req) || {};
    const email = String(b.owner_email || '').toLowerCase().trim();
    if (!email) return err(res, 'owner_email obrigatório');
    const txNote = String(b.tx_note || '').slice(0, 255) || null;

    const rc = await query('SELECT * FROM referral_codes WHERE owner_email = $1', [email]);
    const owner = rc.rows[0] || {};
    const due = await query(
      `SELECT id, commission_amount FROM affiliate_commissions
        WHERE referrer_email=$1 AND status='released' AND payout_id IS NULL`, [email]);
    if (!due.rows.length) return err(res, 'Nada a pagar para este afiliado.');
    const total = due.rows.reduce((s, r) => s + Number(r.commission_amount), 0);

    const pay = await query(
      `INSERT INTO affiliate_payouts (owner_email, owner_name, cpf, pix_key, pix_key_type, amount, status, paid_at, paid_by, tx_note)
       VALUES ($1,$2,$3,$4,$5,$6,'paid',NOW(),$7,$8) RETURNING id`,
      [email, owner.owner_name || null, owner.cpf || null, owner.pix_key || null, owner.pix_key_type || null,
       total.toFixed(2), (req.actor || {}).nome || 'admin', txNote]);
    const payoutId = pay.rows[0].id;
    await query(
      `UPDATE affiliate_commissions SET status='paid', payout_id=$1
        WHERE referrer_email=$2 AND status='released' AND payout_id IS NULL`,
      [payoutId, email]);
    await logAdmin(req, 'affiliate_payout', `${email} R$ ${total.toFixed(2)} (${due.rows.length} itens)`);
    return json(res, { ok: true, payout_id: payoutId, amount: total, itens: due.rows.length });
  }

  // ── liberação manual (janela vencida) ───────────────────
  if (op === 'release_now') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    if (!canManage) return err(res, 'Sem permissão.', 403);
    const rel = await query(
      `UPDATE affiliate_commissions SET status='released', released_at=NOW()
        WHERE status='pending' AND release_at <= NOW() RETURNING id`);
    await logAdmin(req, 'affiliate_release', `${rel.rowCount} comissões`);
    return json(res, { ok: true, released: rel.rowCount });
  }

  // ── parâmetros do programa ──────────────────────────────
  if (op === 'settings_get') {
    return json(res, {
      ok: true,
      price_single: Number(await getSetting('price_single', await getSetting('report_price', '9.90'))),
      price_combo: Number(await getSetting('price_combo', '19.90')),
      discount_pct: Number(await getSetting('referral_discount_pct', '10')),
      commission_pct: Number(await getSetting('referral_commission_pct', '15')),
      window_days: Number(await getSetting('cashback_window_days', '8')),
      window_card: Number(await getSetting('cashback_window_card', '40')),
      min_payout: Number(await getSetting('cashback_min_payout', '20.00')),
      enabled: (await getSetting('referral_enabled', '1')) === '1',
    });
  }

  if (op === 'settings_set') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    if (!canManage) return err(res, 'Sem permissão.', 403);
    const b = getJsonBody(req) || {};
    if (b.price_single !== undefined) {
      const v = Number(b.price_single);
      if (!(v > 0) || v > 999) return err(res, 'Preço avulso inválido (0,01–999).');
      await setSetting('price_single', v.toFixed(2));
      await setSetting('report_price', v.toFixed(2)); // mantém legado em sincronia
    }
    if (b.price_combo !== undefined) {
      const v = Number(b.price_combo);
      if (!(v > 0) || v > 999) return err(res, 'Preço do combo inválido (0,01–999).');
      await setSetting('price_combo', v.toFixed(2));
    }
    if (b.discount_pct !== undefined) {
      const v = Number(b.discount_pct);
      if (!(v >= 0 && v <= 90)) return err(res, 'Desconto inválido (0–90).');
      await setSetting('referral_discount_pct', String(v));
    }
    if (b.commission_pct !== undefined) {
      const v = Number(b.commission_pct);
      if (!(v >= 0 && v <= 90)) return err(res, 'Comissão inválida (0–90).');
      await setSetting('referral_commission_pct', String(v));
    }
    if (b.window_days !== undefined) {
      const v = parseInt(b.window_days, 10);
      if (!(v >= 7 && v <= 60)) return err(res, 'Janela Pix mínima de 7 dias (CDC).');
      await setSetting('cashback_window_days', String(v));
    }
    if (b.window_card !== undefined) {
      const v = parseInt(b.window_card, 10);
      if (!(v >= 7 && v <= 120)) return err(res, 'Janela cartão/boleto inválida (7–120 dias).');
      await setSetting('cashback_window_card', String(v));
    }
    if (b.min_payout !== undefined) {
      const v = Number(b.min_payout);
      if (!(v > 0)) return err(res, 'Mínimo inválido.');
      await setSetting('cashback_min_payout', v.toFixed(2));
    }
    if (b.enabled !== undefined) await setSetting('referral_enabled', b.enabled ? '1' : '0');
    await logAdmin(req, 'affiliate_settings', JSON.stringify(b).slice(0, 200));
    return json(res, { ok: true });
  }

  return err(res, 'op inválida');
};
