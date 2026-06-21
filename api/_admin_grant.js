// POST /api/b2b?fn=admin_grant_credits — credita (ou debita) uma empresa manualmente.
// Protegido pela ADMIN_API_KEY. Lança um movimento 'bonus' na razão de créditos.
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { postLedger, getBalance } = require('./_lib/b2b-auth');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Método não permitido', 405);
  if (!(await requireApiKey(req, res))) return;

  const body = getJsonBody(req) || {};
  const amount = Math.trunc(Number(body.amount));
  const motivo = String(body.reason || 'Crédito manual (admin)').slice(0, 200);
  if (!amount) return err(res, 'Quantidade inválida — use um inteiro diferente de zero (negativo para debitar).');
  if (Math.abs(amount) > 100000) return err(res, 'Quantidade fora do limite (máx. 100.000).');

  // localizar empresa por id ou e-mail
  let company;
  if (body.company_id) {
    const r = await query('SELECT id, nome, email FROM companies WHERE id = $1', [Number(body.company_id)]);
    company = r.rows[0];
  } else if (body.email) {
    const r = await query('SELECT id, nome, email FROM companies WHERE LOWER(email) = LOWER($1)', [String(body.email).trim()]);
    company = r.rows[0];
  }
  if (!company) return err(res, 'Empresa não encontrada.', 404);

  const saldoAntes = await getBalance(company.id);
  if (saldoAntes + amount < 0) return err(res, `Operação deixaria o saldo negativo (saldo atual: ${saldoAntes}).`);

  const saldo = await postLedger(company.id, amount, 'bonus', 'admin_grant', null, { motivo, via: 'admin' });
  await logAdmin(req, 'grant_credits', `${company.nome}: ${amount > 0 ? '+' : ''}${amount} créd. (${motivo})`);
  return json(res, { ok: true, empresa: company.nome, email: company.email, delta: amount, saldo_anterior: saldoAntes, saldo });
};
