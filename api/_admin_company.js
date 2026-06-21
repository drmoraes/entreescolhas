// GET /api/b2b?fn=admin_company&id=N — painel "Empresa 360" para o Admin.
// Saldo, uso, histórico de compras (R$), razão de créditos e alertas da conta.
const { setCors, json, err, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');

async function one(sql, p = []) { const { rows } = await query(sql, p); return rows[0]; }

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;

  const id = Number(req.query && req.query.id);
  if (!id) return err(res, 'id obrigatório');

  const c = await one('SELECT id, nome, email, plan, status, created_at FROM companies WHERE id = $1', [id]);
  if (!c) return err(res, 'Empresa não encontrada', 404);

  const wallet = await one(`
    SELECT COALESCE(SUM(delta),0)::int AS saldo,
           COALESCE(SUM(delta) FILTER (WHERE reason IN ('purchase','bonus')),0)::int AS comprados,
           COALESCE(-SUM(delta) FILTER (WHERE reason='unlock'),0)::int AS gastos
      FROM credit_ledger WHERE company_id = $1`, [id]);

  const uso = await one(`
    SELECT COUNT(*)::int AS unlocks,
           COUNT(*) FILTER (WHERE status='responded')::int AS responderam,
           COUNT(*) FILTER (WHERE status='refunded')::int AS estornos
      FROM unlocks WHERE company_id = $1`, [id]);
  const buscas = await one(
    "SELECT COUNT(*)::int AS n, MAX(created_at) AS ult FROM access_logs WHERE company_id = $1 AND action='search'", [id]);

  const receita = await one(
    "SELECT COALESCE(SUM(price) FILTER (WHERE status='paid'),0)::numeric AS pago, COALESCE(SUM(price) FILTER (WHERE status='pending'),0)::numeric AS pendente FROM credit_orders WHERE company_id = $1", [id]);

  const compras = await query(`
    SELECT created_at, package, credits, price::numeric AS price, status, paid_at
      FROM credit_orders WHERE company_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]);
  const ledger = await query(`
    SELECT created_at, delta, reason, balance_after
      FROM credit_ledger WHERE company_id = $1 ORDER BY created_at DESC LIMIT 15`, [id]);

  // alertas da conta
  const alertas = [];
  const ultBusca = buscas.ult ? new Date(buscas.ult).getTime() : 0;
  if (wallet.saldo > 0 && wallet.comprados > 0 && ultBusca < Date.now() - 30 * 864e5) {
    alertas.push({ sev: 'alto', tipo: 'Crédito ocioso',
      detalhe: `${wallet.saldo} créditos parados; ${ultBusca ? 'sem busca há +30 dias' : 'nunca buscou'}. Acionar onboarding/CS.` });
  }
  const taxaEstorno = uso.unlocks ? Math.round((uso.estornos / uso.unlocks) * 100) : 0;
  if (uso.unlocks >= 3 && taxaEstorno >= 15) {
    alertas.push({ sev: 'medio', tipo: 'Estorno alto',
      detalhe: `${taxaEstorno}% dos desbloqueios estornados — revisar base/contatos da área dela.` });
  }
  if (Number(receita.pendente) > 0) {
    alertas.push({ sev: 'medio', tipo: 'Pagamento pendente', detalhe: `R$ ${Number(receita.pendente).toFixed(2)} aguardando confirmação.` });
  }

  return json(res, {
    ok: true,
    company: { ...c },
    wallet,
    uso: { ...uso, buscas: buscas.n, ult_busca: buscas.ult,
      taxa_resposta: uso.unlocks ? Math.round((uso.responderam / uso.unlocks) * 100) : 0,
      taxa_estorno: taxaEstorno },
    receita: { pago: Number(receita.pago), pendente: Number(receita.pendente) },
    compras: compras.rows.map(x => ({ ...x, price: Number(x.price) })),
    ledger: ledger.rows,
    alertas,
  });
};
