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

// Preço do combo (todos os testes): banco (price_combo) → env → 19.90
async function getPriceCombo() {
  const v = await getSetting('price_combo', null);
  const n = Number(v);
  if (n > 0) return n;
  return Number(process.env.MP_COMBO_PRICE || 19.90);
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

// Janela CDC (dias) antes de liberar a comissão → default 8
async function getReferralWindowDays() {
  const v = parseInt(await getSetting('cashback_window_days', null), 10);
  if (v >= 0 && v <= 60) return v;
  return 8;
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

module.exports = {
  getSetting, setSetting, getReportPrice,
  getPriceSingle, getPriceCombo, getDiscountPct, getCommissionPct,
  getReferralWindowDays, getMinPayout, isReferralEnabled,
};
