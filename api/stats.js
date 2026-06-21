// GET /api/stats — dashboard metrics
const { setCors, json, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;

  const [byStatus, byObj, bySen, byArch, growth, recent, totals] = await Promise.all([
    query('SELECT status, COUNT(*)::int AS cnt FROM candidates GROUP BY status'),
    query('SELECT objetivo, COUNT(*)::int AS cnt FROM candidates GROUP BY objetivo ORDER BY cnt DESC'),
    query("SELECT senioridade, COUNT(*)::int AS cnt FROM candidates WHERE senioridade != '' GROUP BY senioridade ORDER BY cnt DESC"),
    query('SELECT arquetipo, COUNT(*)::int AS cnt FROM candidates WHERE arquetipo IS NOT NULL GROUP BY arquetipo ORDER BY cnt DESC'),
    query(`
      SELECT DATE(created_at) AS day, COUNT(*)::int AS cnt
      FROM candidates
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `),
    query('SELECT id, nome, email, objetivo, arquetipo, status, created_at FROM candidates ORDER BY created_at DESC LIMIT 5'),
    query(`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN status = 'novo' THEN 1 ELSE 0 END)::int AS novo,
        SUM(CASE WHEN status = 'triagem' THEN 1 ELSE 0 END)::int AS triagem,
        SUM(CASE WHEN status = 'entrevista' THEN 1 ELSE 0 END)::int AS entrevista,
        SUM(CASE WHEN status = 'aprovado' THEN 1 ELSE 0 END)::int AS aprovado,
        SUM(CASE WHEN status = 'arquivado' THEN 1 ELSE 0 END)::int AS arquivado,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)::int AS last_7d,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS last_30d
      FROM candidates
    `),
  ]);

  json(res, {
    totals: totals.rows[0],
    by_status: byStatus.rows,
    by_objetivo: byObj.rows,
    by_senioridade: bySen.rows,
    by_arquetipo: byArch.rows,
    growth_30d: growth.rows,
    recent: recent.rows,
  });
};
