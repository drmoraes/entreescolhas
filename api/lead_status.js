// GET /api/lead_status?access=TOKEN — status do lead para o front-end decidir
// se libera o teste, mostra paywall ou já mostra o relatório pago.
const { setCors, json, err } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting, getPriceSingle, getPriceCombo, getCommissionPct } = require('./_lib/settings');
const { computeAmount } = require('./_lib/referral-core');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const access = String(req.query.access ?? '').trim();
  if (!access) return err(res, 'access obrigatório');

  const { rows } = await query(
    `SELECT id, nome, email, jornada, confirmed_at, payment_status, attempts_used, report_json
     FROM leads WHERE access_token = $1`,
    [access]
  );
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);

  // referred_by_code de forma tolerante (coluna pode não existir antes da migração)
  let refCode = null;
  try { const r = await query('SELECT referred_by_code FROM leads WHERE id=$1', [lead.id]); refCode = (r.rows[0] || {}).referred_by_code || null; } catch (e) {}

  // combo pago para este e-mail libera todas as jornadas
  let paid = lead.payment_status === 'paid';
  if (!paid) {
    try {
      const c = await query("SELECT 1 FROM purchases WHERE email=$1 AND kind='combo' AND status='paid' LIMIT 1", [lead.email]);
      if (c.rows[0]) paid = true;
    } catch (e) { /* tabela pode não existir antes da migração */ }
  }

  // preços já com eventual desconto de indicação (calculado no servidor)
  const single = await computeAmount('single', lead.email, refCode);
  const combo = await computeAmount('combo', lead.email, refCode);

  json(res, {
    ok: true,
    nome: lead.nome,
    email: lead.email,
    jornada: lead.jornada,
    confirmed: !!lead.confirmed_at,
    paid,
    attempts_used: Number(lead.attempts_used),
    max_attempts: Number(process.env.MAX_TEST_ATTEMPTS || 3),
    has_report: lead.report_json !== null,
    mp_public_key: process.env.MP_PUBLIC_KEY || null,
    preco: single.amount,                 // compat: avulso já com desconto
    preco_single_base: await getPriceSingle(),
    preco_single: single.amount,
    preco_combo_base: await getPriceCombo(),
    preco_combo: combo.amount,
    credito_upgrade: combo.credit || 0,
    desconto_indicacao: single.discount > 0,
    referido: !!lead.referred_by_code,
    commission_pct: await getCommissionPct(),
    free_mode: (await getSetting('free_mode', '0')) === '1',
  });
};
