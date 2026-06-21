// GET    /api/candidates          — lista com filtros
// GET    /api/candidates?id=N     — candidato individual + notas + log
// PUT    /api/candidates          — atualizar status/notes/tags
// DELETE /api/candidates?id=N     — arquivar (soft delete)
const { setCors, json, err, requireApiKey, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');

const SORTABLE = ['nome', 'email', 'created_at', 'status', 'senioridade'];

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;

  const method = req.method;
  const q = req.query || {};

  // ── GET único ──────────────────────────────────────────
  if (method === 'GET' && q.id) {
    const id = Number(q.id);
    const { rows } = await query('SELECT * FROM candidates WHERE id = $1', [id]);
    const c = rows[0];
    if (!c) return err(res, 'Not found', 404);

    const notes = await query(
      'SELECT * FROM candidate_notes WHERE candidate_id = $1 ORDER BY created_at DESC',
      [id]
    );
    c.notes_list = notes.rows;

    const log = await query(
      'SELECT * FROM candidate_status_log WHERE candidate_id = $1 ORDER BY changed_at DESC LIMIT 20',
      [id]
    );
    c.status_log = log.rows;

    return json(res, c);
  }

  // ── GET lista ──────────────────────────────────────────
  if (method === 'GET') {
    const where = ['1=1'];
    const params = [];

    const addFilter = (col, val, op = '=') => {
      params.push(val);
      where.push(`${col} ${op} $${params.length}`);
    };

    if (q.status) addFilter('status', q.status);
    if (q.objetivo) addFilter('objetivo', q.objetivo);
    if (q.senioridade) addFilter('senioridade', q.senioridade);
    if (q.arquetipo) addFilter('arquetipo', q.arquetipo);
    if (q.cidade) addFilter('cidade', `%${q.cidade}%`, 'LIKE');

    if (q.q) {
      const term = `%${q.q}%`;
      params.push(term, term, term, term);
      const n = params.length;
      where.push(`(nome LIKE $${n-3} OR email LIKE $${n-2} OR cargo LIKE $${n-1} OR empresa LIKE $${n})`);
    }

    if (q.from) addFilter('created_at::date', q.from, '>=');
    if (q.to) addFilter('created_at::date', q.to, '<=');

    const sortCol = SORTABLE.includes(q.sort) ? q.sort : 'created_at';
    const sortDir = (q.dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(q.limit) || 30));
    const offset = (page - 1) * limit;

    const whereSQL = where.join(' AND ');

    const totalRes = await query(`SELECT COUNT(*)::int AS cnt FROM candidates WHERE ${whereSQL}`, params);
    const count = totalRes.rows[0].cnt;

    const dataRes = await query(
      `SELECT id, nome, email, telefone, cidade, objetivo, cargo, empresa,
              senioridade, arquetipo, status, created_at, updated_at
       FROM candidates
       WHERE ${whereSQL}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return json(res, {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
      data: dataRes.rows,
    });
  }

  // ── PUT — atualizar candidato ────────────────────────────
  if (method === 'PUT') {
    const body = getJsonBody(req);
    if (!body || !body.id) return err(res, 'ID obrigatório');

    const id = Number(body.id);
    const { rows: curRows } = await query('SELECT status FROM candidates WHERE id = $1', [id]);
    const row = curRows[0];
    if (!row) return err(res, 'Not found', 404);

    const allowed = ['status', 'cargo', 'empresa', 'cidade', 'senioridade', 'arquetipo', 'tags', 'objetivo'];
    const setParts = [];
    const params = [];

    for (const f of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, f)) {
        params.push(typeof body[f] === 'object' && body[f] !== null ? JSON.stringify(body[f]) : body[f]);
        setParts.push(`${f} = $${params.length}`);
      }
    }

    if (setParts.length) {
      setParts.push('updated_at = NOW()');
      params.push(id);
      await query(`UPDATE candidates SET ${setParts.join(', ')} WHERE id = $${params.length}`, params);

      if (body.status && body.status !== row.status) {
        await query(
          'INSERT INTO candidate_status_log (candidate_id, from_status, to_status) VALUES ($1,$2,$3)',
          [id, row.status, body.status]
        );
      }
    }

    if (body.note && String(body.note).trim()) {
      await query(
        'INSERT INTO candidate_notes (candidate_id, note, author) VALUES ($1,$2,$3)',
        [id, String(body.note).trim(), body.author || 'admin']
      );
    }

    return json(res, { ok: true });
  }

  // ── DELETE — arquivar ────────────────────────────────────
  if (method === 'DELETE' && q.id) {
    const id = Number(q.id);
    await query("UPDATE candidates SET status = 'arquivado', updated_at = NOW() WHERE id = $1", [id]);
    return json(res, { ok: true });
  }

  err(res, 'Method not allowed', 405);
};
