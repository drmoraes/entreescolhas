// Núcleo do Programa de Afiliados (lado servidor). Usado pelo checkout e pelo webhook.
// Mantém o cálculo de preço/desconto e a geração de comissão SEMPRE no servidor.
const { query } = require('./db');
const {
  getPriceSingle, getPriceCombo, getDiscountPct, getCommissionPct,
  getWindowForMethod, isReferralEnabled,
} = require('./settings');

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

// Valida um código de indicação contra o e-mail do comprador (veta autoindicação).
async function validRefFor(email, refCode) {
  if (!refCode) return null;
  if (!(await isReferralEnabled())) return null;
  try {
    const { rows } = await query('SELECT owner_email FROM referral_codes WHERE code = $1', [refCode]);
    if (!rows[0]) return null;
    if (rows[0].owner_email === email) return null; // autoindicação
    return rows[0].owner_email;
  } catch (e) { return null; }
}

// Calcula base/desconto/valor final no servidor.
// Upgrade para combo: se a pessoa já pagou teste(s) avulso(s) antes, o valor já
// pago é abatido do preço do combo (ela não paga duas vezes pelo que já tem).
async function computeAmount(kind, email, refCode) {
  const base = kind === 'combo' ? await getPriceCombo() : await getPriceSingle();
  let credit = 0;
  if (kind === 'combo' && email) {
    try {
      const { rows } = await query(
        "SELECT COALESCE(SUM(amount),0) AS total FROM purchases WHERE email=$1 AND kind='single' AND status='paid'",
        [email]);
      credit = round2(Number(rows[0].total) || 0);
    } catch (e) { credit = 0; /* tabela pode não existir antes da migração */ }
  }
  const baseAfterCredit = Math.max(0, round2(base - credit));
  const refOwner = await validRefFor(email, refCode);
  let discount = 0;
  if (refOwner) discount = round2(baseAfterCredit * (await getDiscountPct()) / 100);
  const amount = round2(baseAfterCredit - discount);
  return { base: round2(base), discount, amount, refOwner, credit };
}

// Cria (ou reusa) o pedido pendente. Devolve a linha de purchases.
async function createPurchase({ email, leadId, kind, jornada, amount, discount, refCode, paymentMethod }) {
  const { rows } = await query(
    `INSERT INTO purchases (email, lead_id, kind, jornada, amount, discount_amount, referred_by_code, payment_method, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
    [email, leadId || null, kind, kind === 'single' ? (jornada || null) : null,
     amount, discount || 0, refCode || null, paymentMethod || null]);
  return rows[0];
}

// Idempotente: efetiva um pedido pago, libera o acesso e gera comissão (se elegível).
// Pode ser chamado tanto pelo retorno do cartão (aprovado na hora) quanto pelo webhook.
async function applyPaidPurchase(purchaseId, paymentMethod) {
  const { rows } = await query('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
  const p = rows[0];
  if (!p) return { ok: false, reason: 'purchase_not_found' };
  const method = paymentMethod || p.payment_method || null;

  // marca como paga só uma vez
  if (p.status !== 'paid') {
    await query(
      `UPDATE purchases SET status='paid', paid_at=NOW(), payment_method=COALESCE($2,payment_method)
         WHERE id=$1 AND status<>'paid'`, [purchaseId, method]);
  }

  // libera acesso: single → a jornada; combo → todas as jornadas do e-mail
  if (p.kind === 'combo') {
    await query("UPDATE leads SET payment_status='paid' WHERE email=$1 AND payment_status<>'paid'", [p.email]);
  } else if (p.lead_id) {
    await query("UPDATE leads SET payment_status='paid' WHERE id=$1 AND payment_status<>'paid'", [p.lead_id]);
  }

  // comissão: para qualquer método aprovado (Pix, cartão ou boleto), com indicação
  // válida (não autoindicação). A JANELA de liberação varia pelo método:
  //   Pix → janela curta (8 dias, CDC); cartão/boleto → janela longa (30–45 dias).
  if (method && p.referred_by_code) {
    const refOwner = await validRefFor(p.email, p.referred_by_code);
    if (refOwner) {
      const pct = await getCommissionPct();
      const commission = round2(Number(p.amount) * pct / 100);
      const windowDays = await getWindowForMethod(method);
      await query(
        `INSERT INTO affiliate_commissions
           (referrer_code, referrer_email, purchase_id, referred_email, purchase_amount,
            commission_pct, commission_amount, status, paid_purchase_at, release_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending', NOW(), NOW() + ($8 || ' days')::interval)
         ON CONFLICT (purchase_id) DO NOTHING`,
        [p.referred_by_code, refOwner, purchaseId, p.email, p.amount, pct, commission, String(windowDays)]);
    }
  }
  return { ok: true, kind: p.kind, email: p.email };
}

// Estorno/arrependimento: marca o pedido como refunded e cancela a comissão.
// 'pending'/'released' ainda não tiveram Pix enviado → simplesmente cancela (nenhum dinheiro
// precisa voltar). 'paid' já foi pago ao afiliado → cancelar silenciosamente esconderia que
// há um valor a recuperar, então sinalizamos clawback_due para o financeiro tratar manualmente.
async function refundPurchase(purchaseId, reason) {
  await query("UPDATE purchases SET status='refunded', refunded_at=NOW() WHERE id=$1 AND status<>'refunded'", [purchaseId]);
  const cancelReason = String(reason || 'estorno').slice(0, 140);

  await query(
    `UPDATE affiliate_commissions
        SET status='cancelled', cancelled_at=NOW(), cancel_reason=$2
      WHERE purchase_id=$1 AND status IN ('pending','released')`,
    [purchaseId, cancelReason]);

  const paid = await query(
    `UPDATE affiliate_commissions
        SET clawback_due=TRUE, clawback_note=$2
      WHERE purchase_id=$1 AND status='paid'
      RETURNING id, referrer_email, commission_amount`,
    [purchaseId, cancelReason]);
  if (paid.rows.length) {
    console.error('[referral] comissão já paga precisa de clawback:', paid.rows.map(r =>
      `commission#${r.id} referrer=${r.referrer_email} valor=${r.commission_amount}`).join('; '));
  }
}

module.exports = { round2, validRefFor, computeAmount, createPurchase, applyPaidPurchase, refundPurchase };
