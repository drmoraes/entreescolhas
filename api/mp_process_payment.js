// POST /api/mp_process_payment — finaliza o pagamento do relatório via API de Pagamentos
// do Mercado Pago, usando o token gerado pelo Payment Brick (checkout transparente).
// Cartão: aprova na hora. Pix/boleto: devolve QR/linha e o webhook confirma depois.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req) || {};
  const access = String(data.access || '').trim();
  if (!access) return err(res, 'access obrigatório');

  const { rows } = await query(
    'SELECT id, email, confirmed_at, payment_status, report_json FROM leads WHERE access_token = $1', [access]);
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.confirmed_at) return err(res, 'E-mail ainda não confirmado', 403);
  if (!lead.report_json) return err(res, 'Conclua o teste antes de pagar', 403);
  if (lead.payment_status === 'paid') return json(res, { status: 'approved', already_paid: true });

  const amount = Number(process.env.MP_REPORT_PRICE || 7.97);
  const payment = {
    transaction_amount: amount,
    description: 'Relatório completo — Entre Escolhas',
    statement_descriptor: 'ENTREESCOLHAS',
    external_reference: access,
    notification_url: `${process.env.APP_BASE_URL}/api/mp_webhook`,
    payer: { email: (data.payer && data.payer.email) || lead.email },
  };
  // Campos vindos do Payment Brick:
  if (data.token) payment.token = data.token;                       // cartão
  if (data.installments) payment.installments = Number(data.installments) || 1;
  if (data.payment_method_id) payment.payment_method_id = data.payment_method_id; // 'pix', 'master', etc.
  if (data.issuer_id) payment.issuer_id = data.issuer_id;
  if (data.payer && data.payer.identification) payment.payer.identification = data.payer.identification;

  let mp;
  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': `pay_${access}_${data.token || data.payment_method_id || 'm'}_${Date.now()}`,
      },
      body: JSON.stringify(payment),
    });
    mp = await r.json();
  } catch (e) {
    console.error('mp_process_payment: erro de rede —', e.message);
    return err(res, 'Não foi possível processar o pagamento agora. Tente novamente.', 502);
  }

  if (mp && mp.status === 'approved') {
    await query(
      "UPDATE leads SET payment_status='paid', mp_payment_id=$1, updated_at=NOW() WHERE id=$2 AND payment_status<>'paid'",
      [String(mp.id), lead.id]);
  } else if (mp && (mp.id)) {
    // guarda a referência do pagamento pendente (Pix/boleto)
    await query('UPDATE leads SET mp_payment_id=$1, updated_at=NOW() WHERE id=$2', [String(mp.id), lead.id]);
  }

  const td = (mp && mp.point_of_interaction && mp.point_of_interaction.transaction_data) || {};
  return json(res, {
    status: mp ? mp.status : 'error',                 // approved | pending | in_process | rejected
    status_detail: mp ? mp.status_detail : null,
    payment_id: mp ? mp.id : null,
    pix_qr: td.qr_code || null,
    pix_qr_base64: td.qr_code_base64 || null,
    ticket_url: td.ticket_url || null,                // boleto/pix link
  });
};
