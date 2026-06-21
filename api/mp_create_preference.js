// POST /api/mp_create_preference — cria a preference do Checkout Pro e
// devolve o init_point para o front-end redirecionar o usuário.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req);
  if (!data) return err(res, 'Invalid JSON');

  const access = String(data.access ?? '').trim();
  if (!access) return err(res, 'access obrigatório');

  const { rows } = await query(
    `SELECT id, email, jornada, confirmed_at, payment_status, report_json
     FROM leads WHERE access_token = $1`,
    [access]
  );
  const lead = rows[0];

  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.confirmed_at) return err(res, 'E-mail ainda não confirmado', 403);
  if (!lead.report_json) return err(res, 'Conclua o teste antes de desbloquear o relatório', 403);

  if (lead.payment_status === 'paid') {
    return json(res, { ok: true, already_paid: true });
  }

  const base = process.env.APP_BASE_URL;
  const backBase = `${base}/obrigado.html?access=${encodeURIComponent(access)}&jornada=${encodeURIComponent(lead.jornada)}`;
  const failureUrl = `${base}/teste.html?jornada=${encodeURIComponent(lead.jornada)}&access=${encodeURIComponent(access)}&pagamento=falhou`;

  const payload = {
    items: [{
      title: 'Relatório completo — Entre Escolhas',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: Number(process.env.MP_REPORT_PRICE || 7.97),
    }],
    payer: { email: lead.email },
    external_reference: access,
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
