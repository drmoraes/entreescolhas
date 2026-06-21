// GET /api/admin_b2b_stats — painel macro do Admin (requer ADMIN_API_KEY).
// KPIs de produto, receita/créditos, qualidade da base, responsividade,
// privacidade (risco de reidentificação) e logs recentes.
const { setCors, json, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');

async function one(sql, params = []) { const { rows } = await query(sql, params); return rows[0]; }

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!requireApiKey(req, res)) return;

  // ── Empresas ───────────────────────────────────────────────
  const companies = await one(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status='ativa')::int AS ativas,
           COUNT(*) FILTER (WHERE status<>'ativa')::int AS inativas
      FROM companies`);

  // ── Funil de busca → desbloqueio ───────────────────────────
  const searches = await one(
    "SELECT COUNT(*)::int AS n FROM access_logs WHERE action='search' AND created_at >= NOW() - INTERVAL '30 days'");
  const unlocks = await one(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status='responded')::int AS respondidos,
           COUNT(*) FILTER (WHERE status='refunded')::int AS estornados,
           COUNT(*) FILTER (WHERE status='active')::int AS ativos
      FROM unlocks WHERE created_at >= NOW() - INTERVAL '30 days'`);

  // ── Créditos ───────────────────────────────────────────────
  const credits = await one(`
    SELECT
      COALESCE(SUM(delta) FILTER (WHERE reason IN ('purchase','bonus')),0)::int AS emitidos,
      COALESCE(-SUM(delta) FILTER (WHERE reason='unlock'),0)::int           AS consumidos,
      COALESCE(SUM(delta) FILTER (WHERE reason IN ('refund_auto','refund_manual')),0)::int AS reembolsados,
      COALESCE(-SUM(delta) FILTER (WHERE reason='expire'),0)::int           AS expirados
      FROM credit_ledger`);

  // ── Qualidade da base ──────────────────────────────────────
  const base = await one(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE b2b_consent)::int AS consentidos,
           COUNT(*) FILTER (WHERE last_confirmed_at >= NOW() - INTERVAL '45 days')::int AS ativos,
           COUNT(*) FILTER (WHERE last_confirmed_at < NOW() - INTERVAL '90 days' OR last_confirmed_at IS NULL)::int AS fantasmas,
           COUNT(*) FILTER (WHERE email_verified)::int AS email_ok,
           COUNT(*) FILTER (WHERE phone_verified)::int AS phone_ok
      FROM candidates WHERE status <> 'arquivado'`);

  // ── Responsividade ─────────────────────────────────────────
  const resp = await one(`
    SELECT
      COUNT(*) FILTER (WHERE invited_at IS NOT NULL)::int AS convidados,
      COUNT(*) FILTER (WHERE status='responded')::int AS responderam,
      ROUND(AVG(EXTRACT(EPOCH FROM (responded_at - invited_at))/3600) FILTER (WHERE responded_at IS NOT NULL)::numeric, 1) AS horas_medias
      FROM unlocks`);

  // ── Privacidade: risco de reidentificação (k-anonimato) ────
  // células (área + senioridade + região) com poucos perfis (k<5)
  const krisk = await one(`
    WITH cells AS (
      SELECT area, senioridade, cidade, COUNT(*)::int AS k
        FROM candidates WHERE b2b_consent AND visibility <> 'hidden'
       GROUP BY area, senioridade, cidade)
    SELECT COUNT(*) FILTER (WHERE k < 5)::int AS celulas_risco,
           COUNT(*)::int AS celulas_total
      FROM cells`);
  const revogacoes = await one(
    "SELECT COUNT(*)::int AS n FROM candidates WHERE b2b_consent = FALSE AND b2b_consent_at IS NOT NULL");

  // ── Receita por cliente (créditos comprados) ───────────────
  const topClients = await query(`
    SELECT c.nome, c.plan,
           COALESCE(-SUM(l.delta) FILTER (WHERE l.reason='unlock'),0)::int AS desbloqueios,
           COALESCE(SUM(l.delta) FILTER (WHERE l.reason='purchase'),0)::int AS comprados
      FROM companies c LEFT JOIN credit_ledger l ON l.company_id = c.id
     GROUP BY c.id, c.nome, c.plan ORDER BY comprados DESC LIMIT 10`);

  // ── Empresas (para conceder créditos / gestão) ─────────────
  const empresas = await query(`
    SELECT c.id, c.nome, c.email, c.plan, c.status,
           COALESCE(SUM(l.delta),0)::int AS saldo
      FROM companies c LEFT JOIN credit_ledger l ON l.company_id = c.id
     GROUP BY c.id, c.nome, c.email, c.plan, c.status
     ORDER BY c.nome LIMIT 200`);

  // ── Logs recentes de acesso a PII ──────────────────────────
  const logs = await query(`
    SELECT a.created_at, a.action, a.company_id, a.candidate_id, a.purpose, co.nome AS empresa
      FROM access_logs a LEFT JOIN companies co ON co.id = a.company_id
     WHERE a.action IN ('reveal_pii','unlock','dispute','refund_auto')
     ORDER BY a.created_at DESC LIMIT 30`);

  // ── Receita em R$ (credit_orders) ──────────────────────────
  const rev = await one(`
    SELECT
      COALESCE(SUM(price) FILTER (WHERE status='paid'),0)::numeric    AS gmv,
      COALESCE(SUM(price) FILTER (WHERE status='pending'),0)::numeric AS pendente,
      COUNT(*) FILTER (WHERE status='paid')::int                      AS pedidos_pagos,
      COALESCE(SUM(credits) FILTER (WHERE status='paid'),0)::int      AS creditos_vendidos
      FROM credit_orders`);
  const mix = await query(`
    SELECT package,
           COUNT(*) FILTER (WHERE status='paid')::int AS vendidos,
           COALESCE(SUM(price) FILTER (WHERE status='paid'),0)::numeric AS receita
      FROM credit_orders GROUP BY package ORDER BY receita DESC`);
  const serie = await query(`
    SELECT to_char(date_trunc('month', paid_at),'YYYY-MM') AS mes,
           COALESCE(SUM(price),0)::numeric AS receita
      FROM credit_orders
     WHERE status='paid' AND paid_at >= date_trunc('month', NOW()) - INTERVAL '11 months'
     GROUP BY 1 ORDER BY 1`);
  const pedidos = await query(`
    SELECT o.created_at, o.package, o.price::numeric AS price, o.status, c.nome AS empresa
      FROM credit_orders o LEFT JOIN companies c ON c.id = o.company_id
     ORDER BY o.created_at DESC LIMIT 8`);
  const topReceita = await query(`
    SELECT c.nome, c.plan, COALESCE(SUM(o.price) FILTER (WHERE o.status='paid'),0)::numeric AS receita
      FROM companies c LEFT JOIN credit_orders o ON o.company_id = c.id
     GROUP BY c.id, c.nome, c.plan ORDER BY receita DESC LIMIT 10`);

  const gmv = Number(rev.gmv);
  const receita = {
    gmv, pendente: Number(rev.pendente),
    pedidos_pagos: rev.pedidos_pagos, creditos_vendidos: rev.creditos_vendidos,
    ticket_medio: rev.pedidos_pagos ? Math.round(gmv / rev.pedidos_pagos) : 0,
    receita_por_credito: rev.creditos_vendidos ? +(gmv / rev.creditos_vendidos).toFixed(2) : 0,
    arpa: companies.ativas ? Math.round(gmv / companies.ativas) : 0,
    mix: mix.rows.map(r => ({ package: r.package, vendidos: r.vendidos, receita: Number(r.receita) })),
    serie: serie.rows.map(r => ({ mes: r.mes, receita: Number(r.receita) })),
    pedidos: pedidos.rows.map(p => ({ created_at: p.created_at, package: p.package, price: Number(p.price), status: p.status, empresa: p.empresa })),
    top: topReceita.rows.map(r => ({ nome: r.nome, plan: r.plan, receita: Number(r.receita) })),
  };

  // ── Alertas de churn / operação ────────────────────────────
  const bal = await query(`
    SELECT company_id,
           COALESCE(SUM(delta),0)::int AS saldo,
           COALESCE(SUM(delta) FILTER (WHERE reason IN ('purchase','bonus')),0)::int AS comprados
      FROM credit_ledger GROUP BY company_id`);
  const lastSearch = await query(
    "SELECT company_id, MAX(created_at) AS ult FROM access_logs WHERE action='search' GROUP BY company_id");
  const unlockAgg = await query(`
    SELECT company_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='refunded')::int AS estornos
      FROM unlocks GROUP BY company_id`);
  const pendOrders = await query(`
    SELECT o.company_id, c.nome, COUNT(*)::int AS n, COALESCE(SUM(o.price),0)::numeric AS valor
      FROM credit_orders o JOIN companies c ON c.id = o.company_id
     WHERE o.status='pending' AND o.created_at < NOW() - INTERVAL '1 day'
     GROUP BY o.company_id, c.nome`);
  const compMap = {};
  for (const c of empresas.rows) compMap[c.id] = c.nome;
  const lsMap = {}; for (const r of lastSearch.rows) lsMap[r.company_id] = r.ult;
  const DAYS30 = Date.now() - 30 * 864e5;
  const alertas = [];
  for (const r of bal.rows) {
    const nome = compMap[r.company_id]; if (!nome) continue;
    const ult = lsMap[r.company_id] ? new Date(lsMap[r.company_id]).getTime() : 0;
    if (r.saldo > 0 && r.comprados > 0 && ult < DAYS30) {
      alertas.push({ sev: 'alto', tipo: 'Crédito ocioso', company_id: r.company_id, empresa: nome,
        detalhe: `${r.saldo} créditos parados; ${ult ? 'sem busca há +30 dias' : 'nunca buscou'}.` });
    }
  }
  for (const u of unlockAgg.rows) {
    const nome = compMap[u.company_id]; if (!nome) continue;
    const taxa = u.total ? Math.round((u.estornos / u.total) * 100) : 0;
    if (u.total >= 3 && taxa >= 15) {
      alertas.push({ sev: 'medio', tipo: 'Estorno alto', company_id: u.company_id, empresa: nome,
        detalhe: `${taxa}% dos desbloqueios estornados (${u.estornos}/${u.total}).` });
    }
  }
  for (const p of pendOrders.rows) {
    alertas.push({ sev: 'medio', tipo: 'Pagamento pendente', company_id: p.company_id, empresa: p.nome,
      detalhe: `${p.n} pedido(s) há +24h — R$ ${Number(p.valor).toFixed(2)}.` });
  }
  const sevRank = { alto: 0, medio: 1, baixo: 2 };
  alertas.sort((a, b) => sevRank[a.sev] - sevRank[b.sev]);

  const convRate = searches.n ? Math.round((unlocks.total / searches.n) * 100) : 0;
  const refundRate = unlocks.total ? Math.round((unlocks.estornados / unlocks.total) * 100) : 0;
  const respRate = resp.convidados ? Math.round((resp.responderam / resp.convidados) * 100) : 0;

  return json(res, {
    companies, base,
    funil: { buscas_30d: searches.n, ...unlocks, conversao_pct: convRate, taxa_estorno_pct: refundRate },
    credits, receita, alertas,
    responsividade: { ...resp, taxa_resposta_pct: respRate },
    privacidade: { ...krisk, revogacoes: revogacoes.n },
    top_clientes: topClients.rows,
    empresas: empresas.rows,
    logs: logs.rows,
  });
};
