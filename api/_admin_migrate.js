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
  // ── Gestão de testes (Rodada 1) ──
  `CREATE TABLE IF NOT EXISTS test_attempts (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    jornada VARCHAR(40) NOT NULL,
    attempt_no SMALLINT NOT NULL,
    report_json JSONB,
    arquetipo VARCHAR(120),
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  "CREATE INDEX IF NOT EXISTS idx_test_attempts_lead ON test_attempts (lead_id)",
  "CREATE INDEX IF NOT EXISTS idx_test_attempts_jornada ON test_attempts (jornada)",
  "CREATE INDEX IF NOT EXISTS idx_test_attempts_created ON test_attempts (created_at DESC)",
  "ALTER TABLE leads ADD COLUMN IF NOT EXISTS reset_count SMALLINT NOT NULL DEFAULT 0",
  "ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ",
  // ── Cupons & cortesia (Rodada 5) ──
  `CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('percent','credits')),
    valor NUMERIC(10,2) NOT NULL,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    valid_until TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','rascunho')),
    description VARCHAR(160),
    created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    order_id INTEGER,
    discount NUMERIC(10,2),
    credits_granted INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW())`,
  "CREATE INDEX IF NOT EXISTS idx_redemptions_coupon ON coupon_redemptions (coupon_id)",
  "ALTER TABLE credit_orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(40)",
  "ALTER TABLE credit_orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2)",
  // ── Governança: usuários admin + auditoria de ações (Rodada 6) ──
  `CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'leitura' CHECK (role IN ('owner','financeiro','suporte','leitura')),
    token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ)`,
  `CREATE TABLE IF NOT EXISTS admin_audit (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER,
    actor_nome VARCHAR(120),
    action VARCHAR(40) NOT NULL,
    detail VARCHAR(240),
    ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW())`,
  "CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit (created_at DESC)",
  // ── Usuários da empresa: papéis ricos + status (Rodada 8) ──
  "ALTER TABLE company_users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ativo'",
  "ALTER TABLE company_users DROP CONSTRAINT IF EXISTS company_users_role_check",
  "ALTER TABLE company_users ADD CONSTRAINT company_users_role_check CHECK (role IN ('owner','gestor','analista','recruiter','leitura'))",
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
  if (!(await requireApiKey(req, res))) return;

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
