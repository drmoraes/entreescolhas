// POST /api/b2b?fn=ai_diagnostico — Diagnóstico de Coaching Comportamental.
// Conecta o resultado do teste a competências comportamentais e gera 3 pontos:
// insight (comportamento atual), oportunidade (desenvolvimento) e ação prática.
// Só disponível para quem já pagou o relatório (mesmo gate do report_json).
// Resultado é cacheado em leads.ai_diagnostico_json — não recalcula (nem
// re-chama a IA, se configurada) a cada vez que a pessoa reabre o relatório.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { gerarDiagnostico } = require('./_lib/ai-diagnostico');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req) || {};
  const access = String(data.access || '').trim();
  if (!access) return err(res, 'access obrigatório');

  // Contexto opcional do cliente (senioridade, segmento, maior desafio). Quando
  // preenchido, o cliente pede regeneração (regen) pra receber a análise cruzada.
  const contexto = (data.contexto && typeof data.contexto === 'object') ? {
    senioridade: String(data.contexto.senioridade || '').slice(0, 80),
    segmento: String(data.contexto.segmento || '').slice(0, 80),
    desafio: String(data.contexto.desafio || '').slice(0, 300),
  } : null;
  const regen = !!data.regen;

  const { rows } = await query(
    'SELECT id, email, jornada, payment_status, report_json FROM leads WHERE access_token = $1',
    [access]
  );
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.report_json) return err(res, 'Conclua o teste antes de gerar o diagnóstico', 403);

  // combo pago para o e-mail também libera (mesma regra do lead_status)
  let paid = lead.payment_status === 'paid';
  if (!paid) {
    try {
      const c = await query("SELECT 1 FROM purchases WHERE email=$1 AND kind='combo' AND status='paid' LIMIT 1", [lead.email]);
      if (c.rows[0]) paid = true;
    } catch (e) { /* tabela pode não existir antes da migração */ }
  }
  if (!paid) return err(res, 'Disponível depois de desbloquear o relatório', 402);

  // já calculado antes? devolve do cache (evita custo repetido de IA).
  // regen=true (cliente preencheu o contexto) força recalcular com a análise cruzada.
  if (!regen) {
    try {
      const cached = await query('SELECT ai_diagnostico_json FROM leads WHERE id=$1', [lead.id]);
      const c = cached.rows[0] && cached.rows[0].ai_diagnostico_json;
      if (c) return json(res, Object.assign({ ok: true, cache: true }, c));
    } catch (e) { /* coluna pode não existir antes da migração — segue sem cache */ }
  }

  const report = lead.report_json;
  const archName = (report.arch && report.arch.name) || null;
  const scores = report.scores || {};
  const dimNames = report.dimNames || {};

  const diag = await gerarDiagnostico({ jornada: lead.jornada, archName, scores, dimNames, contexto });

  try {
    await query('UPDATE leads SET ai_diagnostico_json = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(diag), lead.id]);
  } catch (e) { /* coluna pode não existir antes da migração — funciona sem cache */ }

  return json(res, Object.assign({ ok: true, cache: false }, diag));
};
