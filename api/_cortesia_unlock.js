// POST /api/b2b?fn=cortesia_unlock — libera o relatório completo de GRAÇA quando
// existe uma CORTESIA válida para este cadastro:
//   • cortesia pessoal (vinculada ao e-mail, criada no Admin → Cortesias), ou
//   • link de cortesia (?cortesia=CODIGO), com validade e limite de usos.
// A regra fica em _lib/cortesia.js. Marca como pago (mp_payment_id='cortesia:<code>'),
// registra o uso e envia o relatório por e-mail.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting, setSetting } = require('./_lib/settings');
const mailer = require('./_lib/mailer');
const { sendReportAndMark } = require('./_lib/report-email');
const { resolveCortesia, consumirUso, devolverUso, registrarUso } = require('./_lib/cortesia');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req) || {};
  const access = String(data.access || '').trim();
  if (!access) return err(res, 'access obrigatório');

  const { rows } = await query(
    'SELECT id, nome, email, jornada, confirmed_at, payment_status, report_json FROM leads WHERE access_token = $1', [access]);
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.confirmed_at) return err(res, 'E-mail ainda não confirmado', 403);
  if (!lead.report_json) return err(res, 'Conclua o teste primeiro', 403);
  if (lead.payment_status === 'paid') return json(res, { ok: true, already: true });

  const r = await resolveCortesia({ code: data.code, email: lead.email, jornada: lead.jornada });
  if (!r.ok) return err(res, r.error, 403);

  // Consome o uso ANTES de liberar (atômico: respeita o limite com cliques simultâneos).
  if (!(await consumirUso(r))) return err(res, 'Este link de cortesia atingiu o limite de usos.', 403);

  const up = await query(
    "UPDATE leads SET payment_status='paid', mp_payment_id=$2, updated_at=NOW() WHERE id=$1 AND payment_status <> 'paid' RETURNING id",
    [lead.id, 'cortesia:' + String(r.code).slice(0, 40)]);
  if (!up.rows.length) { await devolverUso(r); return json(res, { ok: true, already: true }); }

  await registrarUso({ cortesiaId: r.entry ? r.entry.id : null, lead, origem: r.entry ? r.entry.tipo : 'link' });
  await sendReportAndMark({ query, mailer, setSetting, getSetting }, lead);

  return json(res, { ok: true });
};
