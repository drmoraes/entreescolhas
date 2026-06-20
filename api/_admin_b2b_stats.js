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

  const convRate = searches.n ? Math.round((unlocks.total / searches.n) * 100) : 0;
  const refundRate = unlocks.total ? Math.round((unlocks.estornados / unlocks.total) * 100) : 0;
  const respRate = resp.convidados ? Math.round((resp.responderam / resp.convidados) * 100) : 0;

  return json(res, {
    companies, base,
    funil: { buscas_30d: searches.n, ...unlocks, conversao_pct: convRate, taxa_estorno_pct: refundRate },
    credits,
    responsividade: { ...resp, taxa_resposta_pct: respRate },
    privacidade: { ...krisk, revogacoes: revogacoes.n },
    top_clientes: topClients.rows,
    empresas: empresas.rows,
    logs: logs.rows,
  });
};
