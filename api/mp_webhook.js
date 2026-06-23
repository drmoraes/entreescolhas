// GET|POST /api/mp_webhook — recebido pelo Mercado Pago a cada evento de
// pagamento. Confirma o pagamento direto na API do MP (nunca confia só no
// payload recebido) e libera o relatório. Sempre responde 200 rapidamente
// para evitar reenvios em loop.
const { query } = require('./_lib/db');
const mailer = require('./_lib/mailer');
const { buildReportEmailHtml } = require('./_lib/report-email');
const { applyPaidPurchase, refundPurchase } = require('./_lib/referral-core');

// external_reference pode vir como 'p{purchaseId}:{access}' (novo) ou só '{access}' (legado)
function parseRef(ref) {
  const m = /^p(\d+):(.+)$/.exec(String(ref || ''));
  if (m) return { purchaseId: Number(m[1]), access: m[2] };
  return { purchaseId: null, access: ref || null };
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const type = q.type ?? q.topic ?? '';
  let paymentId = q.data_id ?? q.id ?? null;
  if (!paymentId && q.data && q.data.id) paymentId = q.data.id;

  if (type !== 'payment' || !paymentId) {
    res.status(200).send('ignored');
    return;
  }

  let payment;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    payment = await r.json();
  } catch (e) {
    console.error('mp_webhook: falha ao consultar pagamento', paymentId, e.message);
    res.status(200).send('error-logged');
    return;
  }

  const status = payment.status ?? null;
  const method = payment.payment_method_id ?? null;
  const { purchaseId, access: accessToken } = parseRef(payment.external_reference);

  // Estorno / arrependimento → cancela pedido e comissão (dentro/fora da janela)
  if (['refunded', 'charged_back', 'cancelled'].includes(status) && purchaseId) {
    try { await refundPurchase(purchaseId, status); } catch (e) { console.error('webhook refund', e.message); }
    res.status(200).send('ok');
    return;
  }

  if (status === 'approved') {
    // Novo fluxo: efetiva o pedido (libera acesso + gera comissão Pix). Idempotente.
    if (purchaseId) {
      try { await applyPaidPurchase(purchaseId, method); } catch (e) { console.error('webhook applyPaid', e.message); }
    }

    // Envio do relatório por e-mail (e compat com leads do fluxo legado)
    if (accessToken) {
      const { rows } = await query(
        'SELECT id, nome, email, payment_status, report_json, report_sent_at FROM leads WHERE access_token = $1',
        [accessToken]
      );
      const lead = rows[0];
      if (lead) {
        if (lead.payment_status !== 'paid') {
          await query(
            "UPDATE leads SET payment_status='paid', mp_payment_id=$1, updated_at=NOW() WHERE id=$2 AND payment_status<>'paid'",
            [String(paymentId), lead.id]
          );
        }
        if (lead.report_json && !lead.report_sent_at) {
          const html = buildReportEmailHtml(lead.nome, lead.report_json);
          const sent = await mailer.send(lead.email, 'Seu relatório completo — Entre Escolhas', html);
          if (sent) {
            await query('UPDATE leads SET report_sent_at = NOW() WHERE id = $1', [lead.id]);
          } else {
            console.error('mp_webhook: falha ao enviar e-mail —', mailer.getLastError());
          }
        }
      }
    }
  }

  res.status(200).send('ok');
};
