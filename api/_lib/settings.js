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

// ── FONTE ÚNICA dos defaults de preço (evita valores divergentes por arquivo) ──
// Produto unificado "Perfil Completo": preço único R$14,97 (âncora "de" R$99,00).
const DEFAULT_SINGLE = 14.97;  // preço do Perfil Completo (teste unificado)
const DEFAULT_SINGLE_BASE = 99.00; // preço-âncora exibido riscado ("de R$99")
const DEFAULT_COMBO  = 19.90;  // legado (combo descontinuado; mantido p/ compat)

// Preço do "Perfil Completo" (produto unificado).
// IMPORTANTE: valores antigos < R$10 (o 9,97 salvo no banco/env ANTES da
// unificação do produto) são IGNORADOS — senão o site exibiria "de R$99 por
// R$14,97" mas cobraria 9,97 (divergência). O admin continua podendo ajustar o
// preço, desde que seja >= R$10. Abaixo disso, usa o preço de lançamento (14,97).
async function getPriceSingle() {
  const n = Number(await getSetting('price_single', null));
  if (n >= 10) return n;
  const envN = Number(process.env.MP_REPORT_PRICE);
  if (envN >= 10) return envN;
  return DEFAULT_SINGLE; // 14,97 (lançamento)
}

// Preço-âncora (riscado) do teste: banco (price_single_anchor) → default 99,00.
async function getPriceSingleAnchor() {
  const v = Number(await getSetting('price_single_anchor', null));
  if (v > 0) return v;
  return DEFAULT_SINGLE_BASE;
}

// Preço do combo (todos os testes): banco (price_combo) → env → default
async function getPriceCombo() {
  const v = await getSetting('price_combo', null);
  const n = Number(v);
  if (n > 0) return n;
  return Number(process.env.MP_COMBO_PRICE || DEFAULT_COMBO);
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
  getPriceSingle, getPriceSingleAnchor, getPriceCombo, getDiscountPct, getCommissionPct,
  getReferralWindowDays, getReferralWindowCard, getWindowForMethod, isCardOrBoleto,
  getMinPayout, isReferralEnabled, getCreditCosts,
  DEFAULT_SINGLE, DEFAULT_SINGLE_BASE, DEFAULT_COMBO,
};
