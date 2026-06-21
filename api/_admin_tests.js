// /api/b2b?fn=admin_tests&op=list|result|reset — gestão de testes (jornadas).
// Protegido por ADMIN_API_KEY. Lista leads/tentativas, mostra resultado e
// reinicia o teste de quem travou (libera novas tentativas).
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');

const MAX = () => Number(process.env.MAX_TEST_ATTEMPTS || 3);

// status derivado para a UI
function statusOf(l, max) {
  const hasReport = l.has_report || l.report_json != null;
  if (!l.confirmed_at) return 'pendente';            // não confirmou e-mail
  if (hasReport) return 'concluido';                 // tem resultado salvo
  if (Number(l.attempts_used) >= max) return 'travado'; // estourou tentativas sem resultado
  if (Number(l.attempts_used) > 0) return 'incompleto';
  return 'confirmado';                               // confirmou, ainda não fez
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;

  const op = String((req.query && req.query.op) || 'list');
  const max = MAX();

  // ── LISTAR ───────────────────────────────────────────────
  if (op === 'list') {
    const q = (req.query && req.query.q) ? `%${String(req.query.q).trim()}%` : null;
    const jornada = (req.query && req.query.jornada) ? String(req.query.jornada) : null;
    const params = [];
    const where = [];
    if (q) { params.push(q); where.push(`(l.nome ILIKE $${params.length} OR l.email ILIKE $${params.length})`); }
    if (jornada) { params.push(jornada); where.push(`l.jornada = $${params.length}`); }
    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await query(
      `SELECT l.id, l.nome, l.email, l.jornada, l.confirmed_at, l.payment_status,
              l.attempts_used, l.reset_count, l.last_reset_at, l.report_json IS NOT NULL AS has_report,
              l.created_at, l.updated_at, l.access_token
         FROM leads l
         ${whereSQL}
        ORDER BY l.updated_at DESC
        LIMIT 300`, params);

    const data = rows.map((l) => ({
      id: l.id, nome: l.nome, email: l.email, jornada: l.jornada,
      confirmed: !!l.confirmed_at, paid: l.payment_status === 'paid',
      attempts_used: Number(l.attempts_used), max_attempts: max,
      reset_count: Number(l.reset_count || 0), last_reset_at: l.last_reset_at,
      has_report: l.has_report, status: statusOf(l, max),
      created_at: l.created_at, updated_at: l.updated_at,
      access_token: l.access_token,
    }));

    // KPIs rápidos
    const k = { total: data.length, concluidos: 0, travados: 0, pendentes: 0, pagos: 0 };
    for (const d of data) {
      if (d.status === 'concluido') k.concluidos++;
      if (d.status === 'travado') k.travados++;
      if (d.status === 'pendente' || d.status === 'confirmado') k.pendentes++;
      if (d.paid) k.pagos++;
    }
    return json(res, { ok: true, kpis: k, max_attempts: max, data });
  }

  // ── RESULTADO (admin vê qualquer um) ─────────────────────
  if (op === 'result') {
    const id = Number(req.query && req.query.id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query(
      `SELECT id, nome, email, jornada, confirmed_at, payment_status, attempts_used,
              report_json, created_at, updated_at
         FROM leads WHERE id = $1`, [id]);
    const l = rows[0];
    if (!l) return err(res, 'Lead não encontrado', 404);

    const hist = await query(
      `SELECT attempt_no, arquetipo, paid, created_at
         FROM test_attempts WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]);

    return json(res, {
      ok: true,
      lead: {
        id: l.id, nome: l.nome, email: l.email, jornada: l.jornada,
        confirmed: !!l.confirmed_at, paid: l.payment_status === 'paid',
        attempts_used: Number(l.attempts_used), max_attempts: max,
        created_at: l.created_at, updated_at: l.updated_at,
      },
      report: l.report_json || null,
      history: hist.rows,
    });
  }

  // ── REINICIAR (libera novas tentativas para quem travou) ──
  if (op === 'reset') {
    if (req.method !== 'POST') return err(res, 'Use POST para reiniciar', 405);
    const body = getJsonBody(req) || {};
    const id = Number(body.id || (req.query && req.query.id));
    if (!id) return err(res, 'id obrigatório');
    const keepReport = body.keep_report !== false; // por padrão preserva o último resultado

    const { rows } = await query('SELECT id, nome, email, jornada, attempts_used FROM leads WHERE id = $1', [id]);
    const l = rows[0];
    if (!l) return err(res, 'Lead não encontrado', 404);

    await query(
      `UPDATE leads
          SET attempts_used = 0,
              reset_count = reset_count + 1,
              last_reset_at = NOW(),
              ${keepReport ? '' : 'report_json = NULL,'}
              updated_at = NOW()
        WHERE id = $1`, [id]);

    // auditoria (best-effort) — access_logs é append-only
    try {
      await query(
        `INSERT INTO access_logs (action, company_id, candidate_id, purpose, ip)
         VALUES ('test_reset', NULL, NULL, $1, $2)`,
        [`lead#${id} ${l.email} (${l.jornada})`, (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null]);
    } catch (e) { /* tabela pode ter colunas diferentes; não bloqueia */ }
    await logAdmin(req, 'test_reset', `lead#${id} ${l.email} (${l.jornada})`);

    return json(res, { ok: true, id, message: 'Teste reiniciado — novas tentativas liberadas.' });
  }

  return err(res, 'op inválida (use list|result|reset)');
};
