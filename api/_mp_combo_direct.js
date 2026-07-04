// POST /api/b2b?fn=mp_combo_direct — COMPRA DIRETA DO COMBO (antes de qualquer teste).
// Diferente de mp_create_preference (que exige teste concluído), aqui a pessoa
// compra o acesso a TODAS as jornadas só com nome+e-mail. Depois do pagamento,
// o desbloqueio acontece por e-mail (purchases kind=combo), então qualquer jornada
// que ela fizer já vem liberada. Endpoint isolado — não toca o fluxo que já vende.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { genToken } = require('./_lib/tokens');
const { checkRateLimit } = require('./_lib/rate-limit');
const { computeAmount, createPurchase } = require('./_lib/referral-core');

const DEFAULT_JORNADA = 'arquetipo';

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req);
  if (!data) return err(res, 'Invalid JSON');

  const nome = String(data.nome ?? '').trim();
  const email = String(data.email ?? '').toLowerCase().trim();
  if (nome.length < 2) return err(res, 'Nome obrigatório');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');

  const rl = await checkRateLimit(req, 'mp_combo_direct', 10);
  if (!rl.ok) return err(res, 'Muitas tentativas. Tente novamente em uma hora.', 429);
  const ip = rl.ip;

  // Indicação (best-effort; nunca pode quebrar a compra)
  let refCode = String(data.ref ?? '').trim().toUpperCase().slice(0, 20) || null;
  if (refCode) {
    try {
      const { rows: rc } = await query('SELECT owner_email FROM referral_codes WHERE code = $1', [refCode]);
      if (!rc[0] || rc[0].owner_email === email) refCode = null; // inexistente ou autoindicação
    } catch (e) { refCode = null; }
  }

  // Já comprou o combo antes? Não cobra de novo — devolve um acesso pra entrar.
  try {
    const c = await query("SELECT 1 FROM purchases WHERE email=$1 AND kind='combo' AND status='paid' LIMIT 1", [email]);
    if (c.rows[0]) {
      const l = await query('SELECT access_token FROM leads WHERE email=$1 ORDER BY id LIMIT 1', [email]);
      return json(res, { ok: true, already_paid: true, access: (l.rows[0] || {}).access_token || null });
    }
  } catch (e) { /* tabela pode não existir antes da migração */ }

  // Cria (ou reusa) um lead auto-confirmado para a jornada padrão — dá à pessoa
  // um access_token para entrar nos testes depois de pagar.
  let leadId, accessToken;
  const ex = await query('SELECT id, access_token FROM leads WHERE email=$1 AND jornada=$2', [email, DEFAULT_JORNADA]);
  if (ex.rows[0]) {
    leadId = ex.rows[0].id;
    accessToken = ex.rows[0].access_token;
    await query('UPDATE leads SET nome=$1, ip=$2, confirmed_at=COALESCE(confirmed_at,NOW()), updated_at=NOW() WHERE id=$3', [nome, ip, leadId]);
  } else {
    accessToken = genToken();
    const ins = await query(
      `INSERT INTO leads (nome, email, jornada, confirm_token, access_token, ip, confirmed_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING id`,
      [nome, email, DEFAULT_JORNADA, genToken(), accessToken, ip]);
    leadId = ins.rows[0].id;
  }
  if (refCode) { try { await query('UPDATE leads SET referred_by_code=$1 WHERE id=$2 AND referred_by_code IS NULL', [refCode, leadId]); } catch (e) {} }

  // Preço e pedido SEMPRE no servidor.
  let amount, purchase;
  try {
    const c = await computeAmount('combo', email, refCode);
    amount = c.amount;
    if (!(amount > 0)) return err(res, 'Este e-mail já tem acesso equivalente ao combo.', 409);
    purchase = await createPurchase({ email, leadId, kind: 'combo', jornada: null, amount, discount: c.discount, refCode, paymentMethod: null });
  } catch (e) {
    console.error('mp_combo_direct: falha ao criar pedido —', e.message);
    return err(res, 'Não foi possível iniciar a compra agora. Tente novamente.', 500);
  }

  const base = process.env.APP_BASE_URL;
  const success = `${base}/combo-ativado.html?access=${encodeURIComponent(accessToken)}`;
  const failure = `${base}/comprar.html?kind=combo&pagamento=falhou`;

  const payload = {
    items: [{ title: 'Combo — todas as jornadas — Entre Escolhas', quantity: 1, currency_id: 'BRL', unit_price: amount }],
    payer: { email },
    external_reference: `p${purchase.id}:${accessToken}`,
    statement_descriptor: 'ENTREESCOLHAS',
    back_urls: { success, pending: success, failure },
    auto_return: 'approved',
    notification_url: `${base}/api/mp_webhook`,
  };

  let response, result;
  try {
    response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      body: JSON.stringify(payload),
    });
    result = await response.json();
  } catch (e) {
    console.error('mp_combo_direct: erro de rede —', e.message);
    return err(res, 'Não foi possível iniciar o pagamento agora. Tente novamente.', 502);
  }
  if (!response.ok || !result.init_point) {
    console.error('mp_combo_direct: resposta inesperada do Mercado Pago —', JSON.stringify(result));
    return err(res, 'Não foi possível iniciar o pagamento agora. Tente novamente.', 502);
  }

  await query('UPDATE leads SET mp_preference_id=$1, updated_at=NOW() WHERE id=$2', [result.id ?? null, leadId]);
  json(res, { ok: true, init_point: result.init_point, access: accessToken });
};
