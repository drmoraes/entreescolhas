// GET /api/b2b?fn=vagas — lista pública de vagas ativas. Sem auth.
// Filtros: q, area, cidade, work_model, arquetipo. Paginação: page.
// Proximidade: near_lat & near_lon → ordena por distância. Facets: áreas disponíveis.
const { setCors, json } = require('./_lib/http');
const { query } = require('./_lib/db');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  const q = req.query || {};
  const where = ["status = 'ativa'", '(expires_at IS NULL OR expires_at > NOW())'];
  const params = [];
  const P = (val) => { params.push(val); return '$' + params.length; };

  if (q.q) { const i = P(`%${String(q.q).trim()}%`); where.push(`(titulo ILIKE ${i} OR empresa ILIKE ${i} OR area ILIKE ${i})`); }
  if (q.area) where.push(`area = ${P(String(q.area))}`);
  if (q.cidade) where.push(`cidade ILIKE ${P(`%${q.cidade}%`)}`);
  if (q.work_model) where.push(`work_model = ${P(String(q.work_model))}`);
  if (q.arquetipo) where.push(`(arquetipos IS NULL OR arquetipos ? ${P(String(q.arquetipo))})`);
  const whereSQL = where.join(' AND ');

  const page = Math.max(1, Number(q.page) || 1);
  const limit = 20;
  const off = (page - 1) * limit;

  // Proximidade (Haversine) quando o candidato compartilha a localização
  const nlat = Number(q.near_lat), nlon = Number(q.near_lon);
  let distSelect = 'NULL::float AS dist_km';
  let orderBy = 'created_at DESC';
  if (isFinite(nlat) && isFinite(nlon)) {
    const a = P(nlat), b = P(nlon);
    distSelect = `CASE WHEN lat IS NULL OR lon IS NULL THEN NULL ELSE
      6371 * acos(LEAST(1, cos(radians(${a}))*cos(radians(lat))*cos(radians(lon)-radians(${b})) + sin(radians(${a}))*sin(radians(lat)))) END AS dist_km`;
    orderBy = 'dist_km ASC NULLS LAST, created_at DESC';
  }

  const { rows } = await query(
    `SELECT id, titulo, empresa, area, cidade, work_model, salario,
            LEFT(COALESCE(descricao,''), 240) AS resumo, url, created_at,
            (url IS NULL OR url = '') AS interna, ${distSelect}
       FROM vagas WHERE ${whereSQL}
      ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${off}`, params);
  const tot = await query(`SELECT COUNT(*)::int AS n FROM vagas WHERE ${whereSQL}`, params);

  // facets de área (para o filtro), independentes dos filtros atuais
  let areas = [];
  try {
    const af = await query(
      "SELECT area, COUNT(*)::int AS n FROM vagas WHERE status='ativa' AND area IS NOT NULL AND area<>'' GROUP BY area ORDER BY n DESC LIMIT 40");
    areas = af.rows;
  } catch (e) {}

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  return json(res, {
    ok: true, page, limit, total: tot.rows[0].n,
    pages: Math.ceil(tot.rows[0].n / limit),
    areas, data: rows,
  });
};
