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

// Preço do relatório do candidato (B2C): banco → env → 7.97
async function getReportPrice() {
  const v = await getSetting('report_price', null);
  const n = Number(v);
  if (n > 0) return n;
  return Number(process.env.MP_REPORT_PRICE || 7.97);
}

module.exports = { getSetting, setSetting, getReportPrice };
