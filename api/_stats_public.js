// GET /api/b2b?fn=stats_public — números públicos para a home (contador rumo a 1 milhão).
// Conta testes CONCLUÍDOS (leads com relatório). Sem autenticação, cacheável.
const { setCors, json } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting } = require('./_lib/settings');

const META = 1000000;

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  let feitos = 0;
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM leads WHERE report_json IS NOT NULL');
    feitos = rows[0] ? rows[0].n : 0;
  } catch (e) { /* tabela pode não existir */ }
  // permite um "ponto de partida" simbólico configurável (ex.: somar lançamentos antigos)
  let base = 0;
  try { base = parseInt(await getSetting('counter_base', '0'), 10) || 0; } catch (e) {}
  const total = feitos + base;
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return json(res, { ok: true, feitos: total, meta: META, faltam: Math.max(0, META - total) });
};
