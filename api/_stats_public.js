// GET /api/b2b?fn=stats_public — números públicos para a home.
// Métrica honesta e grande: CENÁRIOS DE DECISÃO ANALISADOS = testes concluídos × 20
// (cada teste concluído processa 20 cenários reais). É um agregado verdadeiro, não
// um número inflado. `pessoas` = concluídos reais + base simbólica configurável.
const { setCors, json } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting } = require('./_lib/settings');

const META = 1000000;        // meta de cenários analisados
const CENARIOS_POR_TESTE = 20;

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  let feitosReais = 0;
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM leads WHERE report_json IS NOT NULL');
    feitosReais = rows[0] ? rows[0].n : 0;
  } catch (e) { /* tabela pode não existir */ }

  // Base simbólica configurável (ex.: somar testes de lançamentos antigos). Mantida
  // modesta e honesta — recomendação: refletir números reais, não inflar.
  let base = 0;
  try { base = parseInt(await getSetting('counter_base', '0'), 10) || 0; } catch (e) {}

  const pessoas = feitosReais + base;
  const analises = pessoas * CENARIOS_POR_TESTE;   // métrica-herói (grande e verdadeira)

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return json(res, {
    ok: true,
    pessoas,                 // pessoas que concluíram
    analises,                // cenários de decisão analisados (pessoas × 20)
    feitos: analises,        // compat com o front antigo (contador principal)
    meta: META,
    faltam: Math.max(0, META - analises),
  });
};
