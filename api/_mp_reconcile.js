// POST /api/b2b?fn=mp_reconcile — confirma o pagamento consultando o Mercado Pago
// DIRETAMENTE (não depende do webhook). Se aprovado, aplica a compra, marca o lead
// como pago e envia o relatório. Isso torna o polling do front AUTOSSUFICIENTE:
// mesmo que o webhook esteja mal configurado ou atrase, o Pix/boleto é confirmado.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting, setSetting } = require('./_lib/settings');
const mailer = require('./_lib/mailer');
const { sendReportAndMark } = require('./_lib/report-email');
const { applyPaidPurchase } = require('./_lib/referral-core');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req) || {};
  const access = String(data.access || '').trim();
  if (!access) return err(res, 'access obrigatório');

  const { rows } = await query(
    'SELECT id, nome, email, payment_status, report_json, report_sent_at, mp_payment_id FROM leads WHERE access_token = $1',
    [access]);
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (lead.payment_status === 'paid') return json(res, { ok: true, paid: true });
  if (!lead.report_json) return json(res, { ok: true, paid: false, reason: 'no_report' });
  if (!lead.mp_payment_id || !process.env.MP_ACCESS_TOKEN) {
    return json(res, { ok: true, paid: false, reason: 'no_payment' });
  }

  // Consulta o pagamento direto na API do Mercado Pago (fonte da verdade).
  let mp = null;
  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(lead.mp_payment_id), {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    mp = await r.json();
  } catch (e) {
    return json(res, { ok: true, paid: false, reason: 'mp_unreachable' });
  }
  if (!mp || mp.status !== 'approved') {
    return json(res, { ok: true, paid: false, status: mp ? mp.status : 'unknown' });
  }

  // Aprovado → aplica a compra (referral/crédito), se houver, e marca o lead pago.
  const method = mp.payment_method_id || null;
  try {
    const pr = await query("SELECT id, status FROM purchases WHERE mp_payment_id = $1 LIMIT 1", [String(lead.mp_payment_id)]);
    if (pr.rows[0] && pr.rows[0].status !== 'paid') {
      await applyPaidPurchase(pr.rows[0].id, method);
    }
  } catch (e) { console.error('[mp_reconcile] applyPaidPurchase falhou —', e && e.message); }

  await query("UPDATE leads SET payment_status='paid', updated_at=NOW() WHERE id=$1 AND payment_status<>'paid'", [lead.id]);

  // Envia o relatório só se ainda não foi enviado (evita duplicar com o webhook).
  if (!lead.report_sent_at) {
    await sendReportAndMark({ query, mailer, setSetting, getSetting }, lead);
  }

  return json(res, { ok: true, paid: true });
};
