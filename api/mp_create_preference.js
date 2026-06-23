// POST /api/mp_create_preference — cria a preference do Checkout Pro e
// devolve o init_point para o front-end redirecionar o usuário.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getPriceSingle } = require('./_lib/settings');
const { computeAmount, createPurchase } = require('./_lib/referral-core');

async function safeRefCode(leadId) {
  try { const r = await query('SELECT referred_by_code FROM leads WHERE id=$1', [leadId]); return (r.rows[0] || {}).referred_by_code || null; }
  catch (e) { return null; }
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req);
  if (!data) return err(res, 'Invalid JSON');

  const access = String(data.access ?? '').trim();
  if (!access) return err(res, 'access obrigatório');
  const kind = data.kind === 'combo' ? 'combo' : 'single';

  const { rows } = await query(
    `SELECT id, email, jornada, confirmed_at, payment_status, report_json
     FROM leads WHERE access_token = $1`,
    [access]
  );
  const lead = rows[0];

  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.confirmed_at) return err(res, 'E-mail ainda não confirmado', 403);
  if (!lead.report_json) return err(res, 'Conclua o teste antes de desbloquear o relatório', 403);

  if (kind === 'single' && lead.payment_status === 'paid') {
    return json(res, { ok: true, already_paid: true });
  }
  if (kind === 'combo') {
    try {
      const c = await query("SELECT 1 FROM purchases WHERE email=$1 AND kind='combo' AND status='paid' LIMIT 1", [lead.email]);
      if (c.rows[0]) return json(res, { ok: true, already_paid: true });
    } catch (e) { /* tabela ainda não migrada */ }
  }

  // preço/desconto/pedido no servidor; fallback legado se ainda não migrado
  let amount, purchase = null;
  try {
    const refCode = await safeRefCode(lead.id);
    const c = await computeAmount(kind, lead.email, refCode);
    amount = c.amount;
    purchase = await createPurchase({
      email: lead.email, leadId: lead.id, kind, jornada: lead.jornada,
      amount, discount: c.discount, refCode, paymentMethod: null,
    });
  } catch (e) {
    console.error('mp_create_preference: fallback legado —', e.message);
    amount = await getPriceSingle();
    purchase = null;
  }

  const base = process.env.APP_BASE_URL;
  const backBase = `${base}/obrigado.html?access=${encodeURIComponent(access)}&jornada=${encodeURIComponent(lead.jornada)}`;
  const failureUrl = `${base}/teste.html?jornada=${encodeURIComponent(lead.jornada)}&access=${encodeURIComponent(access)}&pagamento=falhou`;

  const payload = {
    items: [{
      title: kind === 'combo' ? 'Combo — todos os testes — Entre Escolhas' : 'Relatório completo — Entre Escolhas',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: amount,
    }],
    payer: { email: lead.email },
    external_reference: purchase ? `p${purchase.id}:${access}` : access,
    statement_descriptor: 'ENTREESCOLHAS',
    back_urls: {
      success: backBase,
      pending: backBase,
      failure: failureUrl,
    },
    auto_return: 'approved',
    notification_url: `${base}/api/mp_webhook`,
  };

  let response, result;
  try {
    response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    result = await response.json();
  } catch (e) {
    console.error('mp_create_preference: erro de rede —', e.message);
    return err(res, 'Não foi possível iniciar o pagamento agora. Tente novamente.', 502);
  }

  if (!response.ok || !result.init_point) {
    console.error('mp_create_preference: resposta inesperada do Mercado Pago —', JSON.stringify(result));
    return err(res, 'Não foi possível iniciar o pagamento agora. Tente novamente.', 502);
  }

  await query('UPDATE leads SET mp_preference_id = $1, updated_at = NOW() WHERE id = $2', [
    result.id ?? null,
    lead.id,
  ]);

  json(res, { ok: true, init_point: result.init_point });
};
