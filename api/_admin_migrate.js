// POST/GET /api/b2b?fn=admin_migrate — aplica a migração de proximidade (cep/lat/lon/...)
// no MESMO banco que a produção usa (via db.js). Idempotente. Protegido por ADMIN_API_KEY.
// Também revela (mascarado) qual conexão a produção está usando, pra diagnóstico.
const { setCors, json, err, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');

// mesmas instruções do api/_schema_cep.sql (inline pra garantir bundling na Vercel)
const STATEMENTS = [
  "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cep VARCHAR(9)",
  "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION",
  "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION",
  "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS idiomas JSONB",
  "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aceita_relocacao BOOLEAN",
  "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS contrato VARCHAR(20)",
  "CREATE INDEX IF NOT EXISTS idx_candidates_geo ON candidates (lat, lon)",
];

const NEEDED = ['cep', 'lat', 'lon', 'idiomas', 'aceita_relocacao', 'contrato'];

function maskConn() {
  const src = process.env.SUPABASE_DB_URL ? 'SUPABASE_DB_URL'
            : process.env.DATABASE_URL ? 'DATABASE_URL' : null;
  const raw = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
  let info = '(sem conexão)';
  try { const u = new URL(raw); info = `host=${u.hostname}:${u.port || ''} user=${u.username}`; } catch {}
  return { source: src, info };
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!requireApiKey(req, res)) return;

  const conn = maskConn();
  const applied = [];
  for (const sql of STATEMENTS) {
    try { await query(sql); applied.push({ sql: sql.slice(0, 60), ok: true }); }
    catch (e) { applied.push({ sql: sql.slice(0, 60), ok: false, error: e.message }); }
  }

  // identidade do banco + colunas presentes
  let dbId = null, cols = [], selectOk = false, selectErr = null;
  try {
    const r = await query('SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS ip');
    dbId = r.rows[0];
  } catch (e) { dbId = { error: e.message }; }
  try {
    const r = await query("SELECT column_name FROM information_schema.columns WHERE table_name='candidates'");
    const have = r.rows.map((x) => x.column_name);
    cols = NEEDED.map((n) => ({ col: n, exists: have.includes(n) }));
  } catch (e) { cols = [{ error: e.message }]; }
  try {
    await query("SELECT id, lat, lon FROM candidates LIMIT 1");
    selectOk = true;
  } catch (e) { selectErr = e.message; }

  return json(res, { ok: true, conexao: conn, banco: dbId, colunas: cols, select_lat_ok: selectOk, select_erro: selectErr, statements: applied });
};
