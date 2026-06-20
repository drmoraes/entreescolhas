// GET|POST /api/mp_webhook_credits — webhook do Mercado Pago para COMPRA DE CRÉDITOS B2B.
// Reconfere o pagamento na API do MP (nunca confia só no payload), credita a empresa
// de forma idempotente (via credit_orders) e responde 200 rápido para evitar reenvios.
const { getDB, query } = require('./_lib/db');

const CREDIT_TTL_DAYS = 365; // créditos avulsos válidos por 12 meses
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }

module.exports = async (req, res) => {
  const q = req.query || {};
  const b = (typeof req.body === 'string' ? safeParse(req.body) : req.body) || {};
  const type = q.type ?? q.topic ?? b.type ?? b.topic ?? '';
  // MP envia o id em vários formatos: ?data.id=, ?id=, body.data.id, body.id
  let paymentId = q['data.id'] ?? q.data_id ?? q.id ?? (q.data && q.data.id) ?? (b.data && b.data.id) ?? b.id ?? null;

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
    console.error('mp_webhook_credits: falha ao consultar pagamento', paymentId, e.message);
    res.status(200).send('error-logged');
    return;
  }

  const status = payment.status ?? null;
  const extRef = payment.external_reference ?? null;

  // só processa nossos pedidos de crédito, aprovados
  if (status !== 'approved' || !extRef || !String(extRef).startsWith('cred_')) {
    res.status(200).send('ok');
    return;
  }

  const client = await getDB().connect();
  try {
    await client.query('BEGIN');
    const ordRes = await client.query(
      'SELECT * FROM credit_orders WHERE external_reference = $1 FOR UPDATE', [extRef]
    );
    const order = ordRes.rows[0];

    if (order && order.status !== 'paid') {
      await client.query(
        "UPDATE credit_orders SET status='paid', mp_payment_id=$1, paid_at=NOW() WHERE id=$2",
        [String(paymentId), order.id]
      );
      const balRes = await client.query(
        'SELECT COALESCE(SUM(delta),0)::int AS s FROM credit_ledger WHERE company_id = $1', [order.company_id]
      );
      const after = balRes.rows[0].s + order.credits;
      const expires = new Date(Date.now() + CREDIT_TTL_DAYS * 86400000);
      await client.query(
        `INSERT INTO credit_ledger (company_id, delta, reason, ref_type, ref_id, balance_after, expires_at, meta)
         VALUES ($1,$2,'purchase','payment',$3,$4,$5,$6)`,
        [order.company_id, order.credits, order.id, after, expires,
         JSON.stringify({ package: order.package, price: order.price, mp_payment_id: String(paymentId) })]
      );
      await client.query(
        `INSERT INTO access_logs (company_id, action, purpose, meta)
         VALUES ($1,'purchase',$2,$3)`,
        [order.company_id, order.package, JSON.stringify({ credits: order.credits, orderId: order.id })]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('mp_webhook_credits: erro ao creditar', extRef, e.message);
  } finally {
    client.release();
  }

  res.status(200).send('ok');
};
