// Configurações editáveis (tabela app_settings). Fallback: env → default.
const { query } = require('./db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await query('SELECT value FROM app_settings WHERE key = $1', [key]);
    if (rows[0] && rows[0].value != null && rows[0].value !== '') return rows[0].value;
  } catch (e) { /* tabela pode não existir ainda */ }
  return fallback;
}

async function setSetting(key, value) {
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]);
}

// Preço do teste avulso (B2C): banco (price_single) → legado (report_price) → env → 9.90
async function getPriceSingle() {
  const v = await getSetting('price_single', null);
  const n = Number(v);
  if (n > 0) return n;
  const legacy = Number(await getSetting('report_price', null));
  if (legacy > 0) return legacy;
  return Number(process.env.MP_REPORT_PRICE || 9.90);
}

// Preço do combo (todos os testes): banco (price_combo) → env → 29.90
async function getPriceCombo() {
  const v = await getSetting('price_combo', null);
  const n = Number(v);
  if (n > 0) return n;
  return Number(process.env.MP_COMBO_PRICE || 29.90);
}

// Compat: getReportPrice continua existindo e aponta para o avulso.
async function getReportPrice() { return getPriceSingle(); }

// % de desconto do Indicado (programa de afiliados) → default 10
async function getDiscountPct() {
  const v = Number(await getSetting('referral_discount_pct', null));
  if (v >= 0 && v <= 90) return v;
  return 10;
}

// % de comissão do Indicador → default 15
async function getCommissionPct() {
  const v = Number(await getSetting('referral_commission_pct', null));
  if (v >= 0 && v <= 90) return v;
  return 15;
}

// Janela (dias) p/ liberar comissão de Pix → default 8 (CDC)
async function getReferralWindowDays() {
  const v = parseInt(await getSetting('cashback_window_days', null), 10);
  if (v >= 0 && v <= 90) return v;
  return 8;
}

// Janela (dias) p/ liberar comissão de cartão/boleto → default 40 (faixa 30–45)
async function getReferralWindowCard() {
  const v = parseInt(await getSetting('cashback_window_card', null), 10);
  if (v >= 0 && v <= 120) return v;
  return 40;
}

// Classifica o método do Mercado Pago e devolve a janela aplicável (em dias).
// 'pix' → janela curta; qualquer outro método aprovado (cartão/boleto) → janela longa.
function isCardOrBoleto(method) {
  return !!method && method !== 'pix';
}
async function getWindowForMethod(method) {
  return method === 'pix' ? getReferralWindowDays() : getReferralWindowCard();
}

// Valor mínimo de saque → default 20.00
async function getMinPayout() {
  const v = Number(await getSetting('cashback_min_payout', null));
  if (v > 0) return v;
  return 20.00;
}

// Programa ligado/desligado → default ligado
async function isReferralEnabled() {
  return (await getSetting('referral_enabled', '1')) === '1';
}

// Custo de crédito (B2B) por categoria de candidato. Defaults pedidos pelo cliente.
async function getCreditCosts() {
  const num = async (k, def) => { const v = parseInt(await getSetting(k, null), 10); return (v >= 0 && v <= 999) ? v : def; };
  return {
    operacional: await num('credit_cost_operacional', 1),
    analista: await num('credit_cost_analista', 4),
    especialista: await num('credit_cost_especialista', 4),
    gerencial: await num('credit_cost_gerencial', 6),
    pcd: await num('credit_cost_pcd', 8),
  };
}

module.exports = {
  getSetting, setSetting, getReportPrice,
  getPriceSingle, getPriceCombo, getDiscountPct, getCommissionPct,
  getReferralWindowDays, getReferralWindowCard, getWindowForMethod, isCardOrBoleto,
  getMinPayout, isReferralEnabled, getCreditCosts,
};
