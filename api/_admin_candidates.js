// /api/b2b?fn=admin_candidates&op=list|get|save|archive|import|invite — CRUD de candidatos (Admin).
// Protegido por ADMIN_API_KEY. Soft-delete (status='arquivado'); nunca apaga duro.
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const mailer = require('./_lib/mailer');
const { geocodeCep } = require('./_lib/geocode');
const { adminCan } = require('./_lib/admin-perms');

// campos que o admin pode editar/criar
const TEXT = ['nome','email','telefone','cidade','area','cargo','empresa','senioridade',
  'experiencia','escolaridade','work_model','availability','arquetipo','linkedin','objetivo','visibility'];
const INT = ['salary_min','salary_max'];
const BOOL = ['b2b_consent','email_verified','phone_verified','pcd'];

function estadoOf(last) {
  if (!last) return 'fantasma';
  const days = (Date.now() - new Date(last).getTime()) / 864e5;
  if (days <= 45) return 'ativo';
  if (days <= 90) return 'frio';
  return 'fantasma';
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const op = String((req.query && req.query.op) || 'list');
  if (['save', 'archive', 'import', 'invite'].includes(op) && !adminCan((req.actor || {}).role, 'candidates'))
    return err(res, 'Seu perfil não tem permissão para editar candidatos.', 403);

  // ── LISTAR ───────────────────────────────────────────────
  if (op === 'list') {
    const q = req.query || {};
    const params = []; const where = [];
    if (q.q) { params.push(`%${String(q.q).trim()}%`); const i = params.length;
      where.push(`(nome ILIKE $${i} OR email ILIKE $${i} OR cargo ILIKE $${i} OR area ILIKE $${i} OR cidade ILIKE $${i})`); }
    if (q.area) { params.push(q.area); where.push(`area = $${params.length}`); }
    if (q.status) { params.push(q.status); where.push(`status = $${params.length}`); }
    else where.push("status <> 'arquivado'");
    if (q.consent === 'sim') where.push('b2b_consent = TRUE');
    if (q.consent === 'nao') where.push('(b2b_consent IS NULL OR b2b_consent = FALSE)');
    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await query(
      `SELECT id, nome, email, area, cargo, senioridade, cidade, status,
              b2b_consent, email_verified, phone_verified, last_confirmed_at, created_at
         FROM candidates ${whereSQL}
        ORDER BY created_at DESC LIMIT 300`, params);

    let estadoFilter = q.estado || null;
    let data = rows.map((c) => ({ ...c, estado: estadoOf(c.last_confirmed_at) }));
    if (estadoFilter) data = data.filter((c) => c.estado === estadoFilter);

    const k = { total: data.length, ativos: 0, frios: 0, fantasmas: 0, consentidos: 0 };
    for (const d of data) { if (d.estado === 'ativo') k.ativos++; if (d.estado === 'frio') k.frios++;
      if (d.estado === 'fantasma') k.fantasmas++; if (d.b2b_consent) k.consentidos++; }
    return json(res, { ok: true, kpis: k, data });
  }

  // ── OBTER ────────────────────────────────────────────────
  if (op === 'get') {
    const id = Number(req.query && req.query.id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query(
      `SELECT id, nome, email, telefone, cidade, area, cargo, empresa, senioridade,
              experiencia, escolaridade, work_model, availability, salary_min, salary_max,
              skills, arquetipo, linkedin, objetivo, visibility, status,
              b2b_consent, email_verified, phone_verified, pcd, pcd_tipo,
              last_confirmed_at, created_at, updated_at, source
         FROM candidates WHERE id = $1`, [id]);
    const c = rows[0];
    if (!c) return err(res, 'Candidato não encontrado', 404);
    c.estado = estadoOf(c.last_confirmed_at);
    return json(res, { ok: true, candidate: c });
  }

  // ── SALVAR (criar / editar) ──────────────────────────────
  if (op === 'save') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const body = getJsonBody(req) || {};
    const id = Number(body.id) || null;

    const nome = String(body.nome || '').trim();
    const email = String(body.email || '').toLowerCase().trim();
    if (id == null) {
      if (nome.length < 2) return err(res, 'Nome obrigatório');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');
    }

    // monta SET/colunas dinamicamente a partir do whitelist
    const cols = [], vals = [];
    const push = (col, val) => { cols.push(col); vals.push(val); };
    for (const f of TEXT) if (f in body) push(f, body[f] === '' ? null : String(body[f]));
    for (const f of INT) if (f in body) push(f, body[f] === '' || body[f] == null ? null : parseInt(body[f], 10));
    for (const f of BOOL) if (f in body) push(f, !!body[f]);
    if ('skills' in body) push('skills', JSON.stringify(Array.isArray(body.skills)
      ? body.skills : String(body.skills || '').split(',').map((s) => s.trim()).filter(Boolean)));
    if ('status' in body) push('status', String(body.status));
    if (body.b2b_consent === true) push('b2b_consent_at', new Date().toISOString());

    if (id) {
      if (!cols.length) return err(res, 'Nada para atualizar');
      const sets = cols.map((c, i) => `${c} = $${i + 1}`);
      vals.push(id);
      const { rows } = await query(
        `UPDATE candidates SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING id`, vals);
      if (!rows[0]) return err(res, 'Candidato não encontrado', 404);
      return json(res, { ok: true, id: rows[0].id, updated: true });
    }

    // criar — garante nome/email + token público
    if (!cols.includes('nome')) push('nome', nome);
    if (!cols.includes('email')) push('email', email);
    push('source', 'admin');
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    try {
      const { rows } = await query(
        `INSERT INTO candidates (${cols.join(', ')}, public_token)
         VALUES (${placeholders.join(', ')}, encode(gen_random_bytes(16),'hex')) RETURNING id`, vals);
      return json(res, { ok: true, id: rows[0].id, created: true });
    } catch (e) {
      if (/unique|duplicate/i.test(e.message)) return err(res, 'Já existe um candidato com esse e-mail', 409);
      throw e;
    }
  }

  // ── ARQUIVAR / DESARQUIVAR (soft-delete) ─────────────────
  if (op === 'archive') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const body = getJsonBody(req) || {};
    const id = Number(body.id);
    if (!id) return err(res, 'id obrigatório');
    const novo = body.unarchive ? 'novo' : 'arquivado';
    const { rows } = await query(
      'UPDATE candidates SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id', [novo, id]);
    if (!rows[0]) return err(res, 'Candidato não encontrado', 404);
    try {
      await query(`INSERT INTO access_logs (action, candidate_id, purpose) VALUES ($1,$2,$3)`,
        [novo === 'arquivado' ? 'cand_archive' : 'cand_unarchive', id, 'admin']);
    } catch (e) { /* não bloqueia */ }
    await logAdmin(req, novo === 'arquivado' ? 'cand_archive' : 'cand_unarchive', `candidato#${id}`);
    return json(res, { ok: true, id, status: novo });
  }

  // ── IMPORTAR EM MASSA (CSV já parseado no cliente) ───────
  if (op === 'import') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const body = getJsonBody(req) || {};
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
    if (!rows.length) return err(res, 'Nenhuma linha para importar');
    const geo = body.geocode !== false;
    let criados = 0, pulados = 0, erros = 0;
    const detalhes = [];
    for (const r of rows) {
      const nome = String(r.nome || '').trim();
      const email = String(r.email || '').toLowerCase().trim();
      if (nome.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { erros++; detalhes.push(`${email || '(sem e-mail)'}: inválido`); continue; }
      const cep = String(r.cep || '').replace(/\D/g, '').slice(0, 8) || null;
      let lat = r.lat != null && r.lat !== '' ? Number(r.lat) : null;
      let lon = r.lon != null && r.lon !== '' ? Number(r.lon) : null;
      if (geo && cep && (lat == null || lon == null)) {
        try { const g = await geocodeCep(cep); if (g) { lat = g.lat; lon = g.lon; } } catch (e) { /* segue sem geo */ }
      }
      try {
        await query(
          `INSERT INTO candidates (nome, email, telefone, cidade, area, cargo, senioridade, cep, lat, lon, source, public_token)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'admin-import', encode(gen_random_bytes(16),'hex'))`,
          [nome, email, String(r.telefone || '') || null, String(r.cidade || '') || null,
           String(r.area || '') || null, String(r.cargo || '') || null, String(r.senioridade || '') || null,
           cep ? (cep.length === 8 ? cep.slice(0, 5) + '-' + cep.slice(5) : cep) : null, lat, lon]);
        criados++;
      } catch (e) {
        if (/unique|duplicate/i.test(e.message)) { pulados++; detalhes.push(`${email}: já existe`); }
        else { erros++; detalhes.push(`${email}: ${e.message}`); }
      }
    }
    await logAdmin(req, 'cand_import', `${criados} criados, ${pulados} dup, ${erros} erros`);
    return json(res, { ok: true, criados, pulados, erros, detalhes: detalhes.slice(0, 40) });
  }

  // ── CONVIDAR (e-mail para 1+ candidatos) ─────────────────
  if (op === 'invite') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const body = getJsonBody(req) || {};
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean).slice(0, 100) : [];
    if (!ids.length) return err(res, 'Selecione ao menos um candidato');
    const msg = String(body.message || '').trim()
      || 'Atualize seu perfil no Entre Escolhas e fique visível para empresas que estão contratando.';
    const base = process.env.APP_BASE_URL || 'https://www.entreescolhas.com.br';
    const { rows } = await query('SELECT id, nome, email FROM candidates WHERE id = ANY($1::int[])', [ids]);
    let enviados = 0, falhas = 0;
    for (const c of rows) {
      if (!c.email) { falhas++; continue; }
      const html = `<p>Olá, ${String(c.nome || '').replace(/[<>&]/g, '')}!</p><p>${msg.replace(/[<>]/g, '')}</p>
        <p><a href="${base}/meu-perfil.html">Atualizar meu perfil</a></p>
        <p style="color:#888;font-size:12px">Entre Escolhas · Banco de Talentos</p>`;
      try {
        const ok = await mailer.send(c.email, 'Atualize seu perfil — Entre Escolhas', html);
        if (ok) { enviados++; await query('UPDATE candidates SET invites_total = COALESCE(invites_total,0) + 1 WHERE id = $1', [c.id]); }
        else falhas++;
      } catch (e) { falhas++; }
    }
    await logAdmin(req, 'cand_invite', `${enviados} enviados, ${falhas} falhas`);
    return json(res, { ok: true, enviados, falhas, total: rows.length });
  }

  return err(res, 'op inválida (use list|get|save|archive|import|invite)');
};
