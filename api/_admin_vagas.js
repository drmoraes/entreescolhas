// /api/b2b?fn=admin_vagas&op=list|save|toggle|delete|import|apps — gestão de vagas (Admin).
// import = puxa da API OFICIAL da Adzuna (legal). Protegido por ADMIN_API_KEY (suporte/owner).
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { adminCan } = require('./_lib/admin-perms');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const op = String((req.query && req.query.op) || 'list');
  if (op !== 'list' && op !== 'apps' && !adminCan((req.actor || {}).role, 'candidates'))
    return err(res, 'Seu perfil não tem permissão para gerenciar vagas.', 403);

  if (op === 'list') {
    const { rows } = await query(
      `SELECT v.*, (SELECT COUNT(*)::int FROM vaga_applications a WHERE a.vaga_id = v.id) AS candidaturas
         FROM vagas v ORDER BY v.created_at DESC LIMIT 300`);
    return json(res, { ok: true, data: rows });
  }

  if (op === 'apps') {
    const vagaId = Number(req.query && req.query.vaga_id);
    if (!vagaId) return err(res, 'vaga_id obrigatório');
    const { rows } = await query(
      'SELECT nome, email, telefone, created_at FROM vaga_applications WHERE vaga_id = $1 ORDER BY created_at DESC LIMIT 500', [vagaId]);
    return json(res, { ok: true, data: rows });
  }

  if (op === 'save') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const b = getJsonBody(req) || {};
    const id = Number(b.id) || null;
    const titulo = String(b.titulo || '').trim();
    if (titulo.length < 3) return err(res, 'Título obrigatório');
    const arq = b.arquetipos ? JSON.stringify(Array.isArray(b.arquetipos) ? b.arquetipos
      : String(b.arquetipos).split(',').map((s) => s.trim()).filter(Boolean)) : null;
    const f = [
      titulo, b.empresa || null, b.area || null, b.cidade || null,
      b.work_model || null, b.salario || null, b.descricao || null, b.url || null, arq,
      b.expires_at || null,
    ];
    if (id) {
      await query(
        `UPDATE vagas SET titulo=$1, empresa=$2, area=$3, cidade=$4, work_model=$5, salario=$6,
                descricao=$7, url=$8, arquetipos=$9, expires_at=$10 WHERE id=$11`, [...f, id]);
      await logAdmin(req, 'vaga_edit', titulo);
      return json(res, { ok: true, id, updated: true });
    }
    const { rows } = await query(
      `INSERT INTO vagas (titulo, empresa, area, cidade, work_model, salario, descricao, url, arquetipos, expires_at, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'direct') RETURNING id`, f);
    await logAdmin(req, 'vaga_create', titulo);
    return json(res, { ok: true, id: rows[0].id, created: true });
  }

  if (op === 'toggle') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const id = Number((getJsonBody(req) || {}).id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query(
      "UPDATE vagas SET status = CASE WHEN status='ativa' THEN 'inativa' ELSE 'ativa' END WHERE id=$1 RETURNING status", [id]);
    if (!rows[0]) return err(res, 'Vaga não encontrada', 404);
    return json(res, { ok: true, id, status: rows[0].status });
  }

  if (op === 'delete') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const id = Number((getJsonBody(req) || {}).id);
    if (!id) return err(res, 'id obrigatório');
    await query('DELETE FROM vagas WHERE id = $1', [id]);
    await logAdmin(req, 'vaga_delete', '#' + id);
    return json(res, { ok: true, id });
  }

  // ── IMPORTAR da Adzuna (API oficial) ─────────────────────
  if (op === 'import') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const APP_ID = process.env.ADZUNA_APP_ID, APP_KEY = process.env.ADZUNA_APP_KEY;
    if (!APP_ID || !APP_KEY) return json(res, {
      error: 'Configure ADZUNA_APP_ID e ADZUNA_APP_KEY nas variáveis da Vercel.',
      _diag: { build: 'v2', has_id: !!APP_ID, has_key: !!APP_KEY,
        adzuna_keys: Object.keys(process.env).filter((k) => k.startsWith('ADZUNA')) }
    }, 400);
    const b = getJsonBody(req) || {};
    const what = encodeURIComponent(String(b.what || '').trim());
    const where = encodeURIComponent(String(b.where || '').trim());
    const pages = Math.min(10, Math.max(1, Number(b.pages) || 5)); // até 10 páginas × 50 = 500
    let encontradas = 0, novas = 0, dup = 0;
    for (let p = 1; p <= pages; p++) {
      const url = `https://api.adzuna.com/v1/api/jobs/br/search/${p}?app_id=${APP_ID}&app_key=${APP_KEY}`
        + `&results_per_page=50&content-type=application/json${what ? '&what=' + what : ''}${where ? '&where=' + where : ''}`;
      let data;
      try { data = await (await fetch(url)).json(); }
      catch (e) { break; }
      const results = (data && data.results) || [];
      if (!results.length) break; // acabaram as páginas
      encontradas += results.length;
      for (const r of results) {
        try {
          const ins = await query(
            `INSERT INTO vagas (titulo, empresa, area, cidade, lat, lon, salario, descricao, url, source, external_id, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'adzuna',$10,'ativa')
             ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING RETURNING id`,
            [String(r.title || '').slice(0, 200), r.company && r.company.display_name, (r.category && r.category.label) || null,
             r.location && r.location.display_name, r.latitude || null, r.longitude || null,
             r.salary_min ? `R$ ${Math.round(r.salary_min)}+` : null, r.description || null,
             r.redirect_url || null, String(r.id || '')]);
          if (ins.rows[0]) novas++; else dup++;
        } catch (e) { /* pula a linha problemática */ }
      }
    }
    await logAdmin(req, 'vaga_import_adzuna', `${novas} novas, ${dup} dup, ${pages}p (q=${b.what || ''})`);
    return json(res, { ok: true, encontradas, novas, duplicadas: dup, paginas: pages });
  }

  return err(res, 'op inválida (use list|save|toggle|delete|import|apps)');
};
