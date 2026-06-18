// GET|POST /api/mp_webhook — recebido pelo Mercado Pago a cada evento de
// pagamento. Confirma o pagamento direto na API do MP (nunca confia só no
// payload recebido) e libera o relatório. Sempre responde 200 rapidamente
// para evitar reenvios em loop.
const { query } = require('./_lib/db');
const mailer = require('./_lib/mailer');
const { buildReportEmailHtml } = require('./_lib/report-email');

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
  const accessToken = payment.external_reference ?? null;

  if (status === 'approved' && accessToken) {
    const { rows } = await query(
      'SELECT id, nome, email, payment_status, report_json, report_sent_at FROM leads WHERE access_token = $1',
      [accessToken]
    );
    const lead = rows[0];

    if (lead && lead.payment_status !== 'paid') {
      await query(
        'UPDATE leads SET payment_status = $1, mp_payment_id = $2, updated_at = NOW() WHERE id = $3',
        ['paid', String(paymentId), lead.id]
      );

      if (lead.report_json && !lead.report_sent_at) {
        const report = lead.report_json; // já vem como objeto (JSONB)
        const html = buildReportEmailHtml(lead.nome, report);
        const sent = await mailer.send(lead.email, 'Seu relatório completo — Entre Escolhas', html);
        if (sent) {
          await query('UPDATE leads SET report_sent_at = NOW() WHERE id = $1', [lead.id]);
        } else {
          console.error('mp_webhook: falha ao enviar e-mail —', mailer.getLastError());
        }
      }
    }
  }

  res.status(200).send('ok');
};
