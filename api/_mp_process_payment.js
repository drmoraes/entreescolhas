// POST /api/mp_process_payment — finaliza o pagamento do relatório via API de Pagamentos
// do Mercado Pago, usando o token gerado pelo Payment Brick (checkout transparente).
// Cartão: aprova na hora. Pix/boleto: devolve QR/linha e o webhook confirma depois.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getPriceSingle } = require('./_lib/settings');
const { computeAmount, createPurchase, applyPaidPurchase } = require('./_lib/referral-core');

// Lê referred_by_code de forma tolerante (coluna pode não existir antes da migração).
async function safeRefCode(leadId) {
  try { const r = await query('SELECT referred_by_code FROM leads WHERE id=$1', [leadId]); return (r.rows[0] || {}).referred_by_code || null; }
  catch (e) { return null; }
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req) || {};
  const access = String(data.access || '').trim();
  if (!access) return err(res, 'access obrigatório');
  const kind = data.kind === 'combo' ? 'combo' : 'single';

  const { rows } = await query(
    'SELECT id, email, jornada, confirmed_at, payment_status, report_json FROM leads WHERE access_token = $1', [access]);
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.confirmed_at) return err(res, 'E-mail ainda não confirmado', 403);
  if (!lead.report_json) return err(res, 'Conclua o teste antes de pagar', 403);
  if (kind === 'single' && lead.payment_status === 'paid') {
    return json(res, { status: 'approved', already_paid: true });
  }
  if (kind === 'combo') {
    try {
      const c = await query("SELECT 1 FROM purchases WHERE email=$1 AND kind='combo' AND status='paid' LIMIT 1", [lead.email]);
      if (c.rows[0]) return json(res, { status: 'approved', already_paid: true });
    } catch (e) { /* tabela ainda não migrada */ }
  }

  // Preço, desconto e pedido SEMPRE no servidor. Se as tabelas novas ainda não
  // existem (deploy antes da migração), cai no fluxo legado (avulso, sem combo/indicação).
  let amount, purchase = null;
  try {
    const refCode = await safeRefCode(lead.id);
    const c = await computeAmount(kind, lead.email, refCode);
    amount = c.amount;
    purchase = await createPurchase({
      email: lead.email, leadId: lead.id, kind, jornada: lead.jornada,
      amount, discount: c.discount, refCode, paymentMethod: data.payment_method_id,
    });
  } catch (e) {
    console.error('mp_process_payment: fallback legado —', e.message);
    amount = await getPriceSingle();
    purchase = null;
  }

  const payment = {
    transaction_amount: amount,
    description: kind === 'combo' ? 'Combo — todos os testes — Entre Escolhas' : 'Relatório completo — Entre Escolhas',
    statement_descriptor: 'ENTREESCOLHAS',
    external_reference: purchase ? `p${purchase.id}:${access}` : access,
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
        // Chave estável por tentativa (SEM Date.now()): um duplo-clique com o mesmo
        // token/método reusa a chave e o Mercado Pago deduplica → nunca cobra duas vezes.
        // Tentativas distintas (novo token de cartão) geram chave nova normalmente.
        'X-Idempotency-Key': `pay_${access}_${data.token || data.payment_method_id || 'm'}_${amount}`,
      },
      body: JSON.stringify(payment),
    });
    mp = await r.json();
  } catch (e) {
    console.error('mp_process_payment: erro de rede —', e.message);
    return err(res, 'Não foi possível processar o pagamento agora. Tente novamente.', 502);
  }

  const method = (mp && mp.payment_method_id) || data.payment_method_id || null;
  if (mp && mp.id) {
    if (purchase) {
      await query('UPDATE purchases SET mp_payment_id=$1, payment_method=COALESCE($2,payment_method) WHERE id=$3',
        [String(mp.id), method, purchase.id]);
    }
    await query('UPDATE leads SET mp_payment_id=$1, updated_at=NOW() WHERE id=$2', [String(mp.id), lead.id]);
  }
  if (mp && mp.status === 'approved') {
    if (purchase) {
      // cartão aprovado na hora → libera acesso e (se Pix) gera comissão. Idempotente.
      await applyPaidPurchase(purchase.id, method);
    } else {
      // fluxo legado: marca o lead como pago
      await query("UPDATE leads SET payment_status='paid', updated_at=NOW() WHERE id=$1 AND payment_status<>'paid'", [lead.id]);
    }
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
