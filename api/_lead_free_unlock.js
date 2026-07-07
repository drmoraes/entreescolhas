// POST /api/b2b?fn=lead_free_unlock — libera o relatório completo de GRAÇA,
// SOMENTE quando o modo grátis (free_mode) está ligado no admin. Marca como pago
// (mp_payment_id='free') e envia o relatório por e-mail. Empurra pro Banco de Talentos.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting, setSetting } = require('./_lib/settings');
const mailer = require('./_lib/mailer');
const { sendReportAndMark } = require('./_lib/report-email');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const free = (await getSetting('free_mode', '0')) === '1';
  if (!free) return err(res, 'Modo grátis desativado.', 403);

  const data = getJsonBody(req) || {};
  const access = String(data.access || '').trim();
  if (!access) return err(res, 'access obrigatório');

  const { rows } = await query(
    'SELECT id, nome, email, confirmed_at, payment_status, report_json FROM leads WHERE access_token = $1', [access]);
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.confirmed_at) return err(res, 'E-mail ainda não confirmado', 403);
  if (!lead.report_json) return err(res, 'Conclua o teste primeiro', 403);
  if (lead.payment_status === 'paid') return json(res, { ok: true, already: true });

  await query("UPDATE leads SET payment_status='paid', mp_payment_id='free', updated_at=NOW() WHERE id=$1", [lead.id]);
  await sendReportAndMark({ query, mailer, setSetting, getSetting }, lead);

  return json(res, { ok: true });
};
