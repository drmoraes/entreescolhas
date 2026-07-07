// POST /api/b2b?fn=cortesia_unlock — libera o relatório completo de GRAÇA quando
// o link traz um CÓDIGO DE CORTESIA válido. Suporta validade e limite de usos por
// código (setting JSON `cortesia_config`), com fallback pra lista simples ilimitada
// (setting `cortesia_codes`). Marca como pago (mp_payment_id='cortesia:<code>') e
// envia o relatório por e-mail.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting, setSetting } = require('./_lib/settings');
const mailer = require('./_lib/mailer');
const { sendReportAndMark } = require('./_lib/report-email');

function parseList(raw) {
  return String(raw || '').split(/[,\n;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
}
function loadConfig(raw) {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function today() { return new Date().toISOString().slice(0, 10); } // YYYY-MM-DD (UTC)

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req) || {};
  const access = String(data.access || '').trim();
  const code = String(data.code || '').trim().toUpperCase();
  if (!access) return err(res, 'access obrigatório');
  if (!code) return err(res, 'Código de cortesia ausente.');

  // 1) Config estruturada (validade + limite). 2) fallback lista simples (ilimitada).
  const config = loadConfig(await getSetting('cortesia_config', '[]'));
  const simple = parseList(await getSetting('cortesia_codes', ''));
  const entry = config.find(c => String(c.code || '').trim().toUpperCase() === code);

  if (!entry && !simple.includes(code)) {
    return err(res, 'Código de cortesia inválido ou expirado.', 403);
  }
  if (entry) {
    if (entry.expires && String(entry.expires).slice(0, 10) < today()) {
      return err(res, 'Este link de cortesia expirou.', 403);
    }
    const max = parseInt(entry.max_uses, 10) || 0;
    const uses = parseInt(entry.uses, 10) || 0;
    if (max > 0 && uses >= max) {
      return err(res, 'Este link de cortesia atingiu o limite de usos.', 403);
    }
  }

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

  // Incrementa o contador de usos do código (best-effort; volume baixo).
  if (entry) {
    try {
      entry.uses = (parseInt(entry.uses, 10) || 0) + 1;
      await setSetting('cortesia_config', JSON.stringify(config));
    } catch (e) { /* não bloqueia a liberação */ }
  }

  await sendReportAndMark({ query, mailer, setSetting, getSetting }, lead);

  return json(res, { ok: true });
};
