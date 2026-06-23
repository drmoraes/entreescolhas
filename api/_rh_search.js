// GET /api/rh_search — busca de candidatos ANÔNIMOS com scores.
// Filtros: q, area, senioridade, work_model, cidade, availability, skills (csv),
//          salary_max, min_confidence, include_cold (default false), page, limit.
// Nunca retorna PII. Marca quais já foram desbloqueados pela empresa.
const { setCors, json, err } = require('./_lib/http');
const { query } = require('./_lib/db');
const { requireCompany, logAccess } = require('./_lib/b2b-auth');
const { anonymizeCandidate } = require('./_lib/anonymize');
const { getClientIp } = require('./_lib/rate-limit');
const { geocodeCep } = require('./_lib/geocode');
const { creditCostFor } = require('./_lib/credits');
const { getCreditCosts } = require('./_lib/settings');

const FETCH_CAP = 300; // janela máx. para ranqueamento em memória

// Detecta uma vez se as colunas novas (categoria/setores) já foram migradas.
let _hasCat = null;
async function hasCategoriaCol() {
  if (_hasCat != null) return _hasCat;
  try {
    const r = await query("SELECT 1 FROM information_schema.columns WHERE table_name='candidates' AND column_name='categoria' LIMIT 1");
    _hasCat = r.rows.length > 0;
  } catch (e) { _hasCat = false; }
  return _hasCat;
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const ctx = await requireCompany(req, res);
  if (!ctx) return;
  const q = req.query || {};

  // base: só candidatos consentidos e não-ocultos
  const where = [
    "visibility <> 'hidden'",
    'b2b_consent = TRUE',
    "status NOT IN ('arquivado')",
  ];
  const params = [];
  const add = (col, val, op = '=') => { params.push(val); where.push(`${col} ${op} $${params.length}`); };

  const hasCat = await hasCategoriaCol();

  if (q.area) add('area', q.area);
  if (q.senioridade) add('senioridade', q.senioridade);
  if (q.work_model) add('work_model', q.work_model);
  if (q.availability) add('availability', q.availability);
  if (q.cidade) add('cidade', `%${q.cidade}%`, 'ILIKE');
  if (q.salary_max) { params.push(Number(q.salary_max) * 1.15); where.push(`(salary_min IS NULL OR salary_min <= $${params.length})`); }
  if (q.cargo) add('cargo', `%${q.cargo}%`, 'ILIKE');

  // PCD (coluna do schema base): 'true' só PCD, 'false' exclui PCD
  if (q.pcd === 'true') where.push('pcd = TRUE');
  else if (q.pcd === 'false') where.push('(pcd IS NULL OR pcd = FALSE)');

  // categoria e setor (somente após a migração RH)
  if (hasCat && q.categoria) add('categoria', q.categoria);
  if (hasCat && q.setor) { params.push(`%${q.setor}%`); where.push(`(setores::text ILIKE $${params.length})`); }

  // regra de exposição de frios: por padrão oculta perfis frios (>90d sem confirmar)
  const includeCold = String(q.include_cold || '') === 'true';
  if (!includeCold) {
    where.push("(last_confirmed_at IS NOT NULL AND last_confirmed_at >= NOW() - INTERVAL '90 days')");
  }

  const whereSQL = where.join(' AND ');
  const extraCols = hasCat ? ', categoria, setores' : '';
  const { rows } = await query(
    `SELECT id, public_token, area, cargo, senioridade, experiencia, escolaridade,
            cidade, work_model, availability, salary_min, salary_max, empresa,
            skills, arquetipo, arquetipo_scores, last_confirmed_at, lat, lon, aceita_relocacao,
            email_verified, phone_verified, invites_total, responses_received,
            pcd, pcd_tipo${extraCols}
       FROM candidates
      WHERE ${whereSQL}
      ORDER BY last_confirmed_at DESC NULLS LAST
      LIMIT ${FETCH_CAP}`,
    params
  );

  // local da vaga (proximidade): usa lat/lon do cliente; se não vierem, geocodifica o CEP no servidor
  let jobLat = q.job_lat ? Number(q.job_lat) : null;
  let jobLon = q.job_lon ? Number(q.job_lon) : null;
  let jobGeoAprox = false;
  if ((jobLat == null || jobLon == null) && q.job_cep) {
    const g = await geocodeCep(q.job_cep);
    if (g) { jobLat = g.lat; jobLon = g.lon; jobGeoAprox = !g.exact; }
  }

  // critérios para o Score de Aderência
  const criteria = {
    skills: q.skills ? String(q.skills).split(',').map((s) => s.trim()).filter(Boolean) : [],
    setor: q.setor || null,
    senioridade: q.senioridade || null,
    work_model: q.work_model || null,
    cidade: q.cidade || null,
    salary_max: q.salary_max ? Number(q.salary_max) : null,
    job_lat: jobLat,   // local da vaga (proximidade)
    job_lon: jobLon,
    job_geo_aprox: jobGeoAprox,
  };

  // desbloqueios já feitos por esta empresa
  const unlockedRes = await query(
    'SELECT candidate_id FROM unlocks WHERE company_id = $1', [ctx.company_id]
  );
  const unlockedSet = new Set(unlockedRes.rows.map((r) => r.candidate_id));

  const costs = await getCreditCosts();
  let items = rows.map((c) => {
    const dto = anonymizeCandidate(c, criteria);
    dto.unlocked = unlockedSet.has(c.id);
    const ci = creditCostFor(c, costs);
    dto.credit_cost = ci.cost;
    dto.categoria_efetiva = ci.categoria; // operacional|analista|especialista|gerencial|pcd
    return dto;
  });

  // filtro de confiança mínima (pós-score)
  const minConf = Number(q.min_confidence) || 0;
  if (minConf > 0) items = items.filter((i) => i.confidence >= minConf);

  // ranqueamento: aderência desc, depois confiança desc
  items.sort((a, b) => (b.adherence - a.adherence) || (b.confidence - a.confidence));

  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(48, Math.max(6, Number(q.limit) || 12));
  const total = items.length;
  const slice = items.slice((page - 1) * limit, (page - 1) * limit + limit);

  await logAccess(ctx, null, 'search', JSON.stringify(criteria).slice(0, 150), getClientIp(req),
    { total, filtros: { ...q, key: undefined, session: undefined } });

  return json(res, {
    total, page, limit, pages: Math.ceil(total / limit),
    criteria, data: slice,
  });
};
