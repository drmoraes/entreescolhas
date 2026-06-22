// GET /api/lead_status?access=TOKEN — status do lead para o front-end decidir
// se libera o teste, mostra paywall ou já mostra o relatório pago.
const { setCors, json, err } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getReportPrice, getSetting } = require('./_lib/settings');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const access = String(req.query.access ?? '').trim();
  if (!access) return err(res, 'access obrigatório');

  const { rows } = await query(
    `SELECT nome, jornada, confirmed_at, payment_status, attempts_used, report_json
     FROM leads WHERE access_token = $1`,
    [access]
  );
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);

  json(res, {
    ok: true,
    nome: lead.nome,
    jornada: lead.jornada,
    confirmed: !!lead.confirmed_at,
    paid: lead.payment_status === 'paid',
    attempts_used: Number(lead.attempts_used),
    max_attempts: Number(process.env.MAX_TEST_ATTEMPTS || 3),
    has_report: lead.report_json !== null,
    mp_public_key: process.env.MP_PUBLIC_KEY || null,
    preco: await getReportPrice(),
    free_mode: (await getSetting('free_mode', '0')) === '1',
  });
};
