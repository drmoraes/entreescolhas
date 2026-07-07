// POST /api/b2b?fn=cortesia_unlock — libera o relatório completo de GRAÇA quando
// o link traz um CÓDIGO DE CORTESIA válido (setting `cortesia_codes`, lista
// separada por vírgula). Diferente do free_mode global: só quem tem o código libera.
// Marca como pago (mp_payment_id='cortesia:<code>') e envia o relatório por e-mail.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting } = require('./_lib/settings');
const mailer = require('./_lib/mailer');
const { buildReportEmailHtml } = require('./_lib/report-email');

function parseCodes(raw) {
  return String(raw || '')
    .split(/[,\n;]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req) || {};
  const access = String(data.access || '').trim();
  const code = String(data.code || '').trim().toUpperCase();
  if (!access) return err(res, 'access obrigatório');
  if (!code) return err(res, 'Código de cortesia ausente.');

  const valid = parseCodes(await getSetting('cortesia_codes', ''));
  if (!valid.includes(code)) return err(res, 'Código de cortesia inválido ou expirado.', 403);

  const { rows } = await query(
    'SELECT id, nome, email, confirmed_at, payment_status, report_json FROM leads WHERE access_token = $1', [access]);
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.confirmed_at) return err(res, 'E-mail ainda não confirmado', 403);
  if (!lead.report_json) return err(res, 'Conclua o teste primeiro', 403);
  if (lead.payment_status === 'paid') return json(res, { ok: true, already: true });

  await query(
    "UPDATE leads SET payment_status='paid', mp_payment_id=$2, updated_at=NOW() WHERE id=$1",
    [lead.id, 'cortesia:' + code.slice(0, 40)]);
  try {
    const html = buildReportEmailHtml(lead.nome, lead.report_json);
    const ok = await mailer.send(lead.email, 'Seu relatório completo — Entre Escolhas', html);
    if (ok) await query('UPDATE leads SET report_sent_at = NOW() WHERE id = $1', [lead.id]);
  } catch (e) { /* não bloqueia */ }

  return json(res, { ok: true });
};
