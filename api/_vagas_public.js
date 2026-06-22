// GET /api/b2b?fn=vagas — lista pública de vagas ativas (com filtros). Sem auth.
// Filtros: q, area, cidade, work_model, arquetipo (matching), page.
const { setCors, json } = require('./_lib/http');
const { query } = require('./_lib/db');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  const q = req.query || {};
  const where = ["status = 'ativa'", '(expires_at IS NULL OR expires_at > NOW())'];
  const params = [];
  const add = (clause, val) => { params.push(val); where.push(clause.replace('$$', '$' + params.length)); };
  if (q.q) add("(titulo ILIKE $$ OR empresa ILIKE $$ OR area ILIKE $$)".replace(/\$\$/g, () => '$' + (params.length + 1)), `%${String(q.q).trim()}%`);
  if (q.area) add('area = $$', q.area);
  if (q.cidade) add('cidade ILIKE $$', `%${q.cidade}%`);
  if (q.work_model) add('work_model = $$', q.work_model);
  if (q.arquetipo) { params.push(q.arquetipo); where.push(`(arquetipos IS NULL OR arquetipos ? $${params.length})`); }

  const page = Math.max(1, Number(q.page) || 1);
  const limit = 24;
  const off = (page - 1) * limit;

  const { rows } = await query(
    `SELECT id, titulo, empresa, area, cidade, work_model, salario,
            LEFT(COALESCE(descricao,''), 280) AS resumo, url, source, created_at,
            (url IS NULL OR url = '') AS interna
       FROM vagas WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${off}`, params);
  const tot = await query(`SELECT COUNT(*)::int AS n FROM vagas WHERE ${where.join(' AND ')}`, params);

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  return json(res, { ok: true, page, total: tot.rows[0].n, data: rows });
};
