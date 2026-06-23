// GET /api/lead_report?access=TOKEN — devolve o relatório completo já salvo,
// somente se o lead estiver com pagamento confirmado.
const { setCors, json, err } = require('./_lib/http');
const { query } = require('./_lib/db');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const access = String(req.query.access ?? '').trim();
  if (!access) return err(res, 'access obrigatório');

  const { rows } = await query(
    'SELECT nome, email, jornada, payment_status, report_json, created_at FROM leads WHERE access_token = $1',
    [access]
  );
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (lead.payment_status !== 'paid') return err(res, 'Relatório ainda não desbloqueado', 402);
  if (!lead.report_json) return err(res, 'Relatório ainda não gerado', 404);

  json(res, {
    ok: true,
    jornada: lead.jornada,
    nome: lead.nome,
    email: lead.email,
    created_at: lead.created_at,
    report: lead.report_json, // pg já devolve JSONB como objeto
  });
};
