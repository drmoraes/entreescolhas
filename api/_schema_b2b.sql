-- ═══════════════════════════════════════════════════════════
-- Entre Escolhas — Banco de Talentos B2B (camada de recrutamento)
-- Rode UMA VEZ no SQL Editor do Supabase, DEPOIS de _schema.sql.
-- Adiciona: empresas (clientes RH), usuários, créditos, desbloqueios,
-- auditoria imutável, disputas/reembolsos e colunas B2B em candidates.
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Empresas (clientes RH) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(255) NOT NULL,
  cnpj        VARCHAR(20),
  email       VARCHAR(255) NOT NULL UNIQUE,
  plan        VARCHAR(20) NOT NULL DEFAULT 'trial'
                CHECK (plan IN ('trial','starter','growth','business')),
  status      VARCHAR(20) NOT NULL DEFAULT 'ativa'
                CHECK (status IN ('ativa','inativa','suspensa')),
  reputation  SMALLINT NOT NULL DEFAULT 100,   -- anti-abuso de disputas (0-100)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usuários da empresa (recrutadores) — autenticação ────────
CREATE TABLE IF NOT EXISTS company_users (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,        -- pbkdf2: salt:hash
  role            VARCHAR(20) NOT NULL DEFAULT 'recruiter'
                    CHECK (role IN ('owner','recruiter')),
  session_token   VARCHAR(64),
  session_expires TIMESTAMPTZ,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_users_session ON company_users (session_token);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users (company_id);

-- ── Razão de créditos (carteira = SUM(delta)) ────────────────
CREATE TABLE IF NOT EXISTS credit_ledger (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL,              -- +compra/bônus/reembolso, -desbloqueio/expiração
  reason        VARCHAR(40) NOT NULL
                  CHECK (reason IN ('purchase','bonus','unlock','refund_auto','refund_manual','expire','adjust')),
  ref_type      VARCHAR(40),                   -- 'unlock','dispute','payment'
  ref_id        INTEGER,
  balance_after INTEGER,
  meta          JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ                     -- créditos de plano expiram no ciclo
);
CREATE INDEX IF NOT EXISTS idx_ledger_company ON credit_ledger (company_id, created_at);

-- ── Desbloqueios (empresa desbloqueou um candidato) ──────────
CREATE TABLE IF NOT EXISTS unlocks (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_user_id INTEGER REFERENCES company_users(id) ON DELETE SET NULL,
  candidate_id    INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  credits_spent   INTEGER NOT NULL DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','responded','refunded','expired','disputed')),
  contact_valid   BOOLEAN,
  adherence_score SMALLINT,
  confidence_score SMALLINT,
  invited_at      TIMESTAMPTZ,
  sla_deadline    TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  refunded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_unlocks_company ON unlocks (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_unlocks_sla     ON unlocks (status, sla_deadline);

-- ── Trilha de auditoria (append-only, imutável) ──────────────
CREATE TABLE IF NOT EXISTS access_logs (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER,
  company_user_id INTEGER,
  candidate_id    INTEGER,
  action          VARCHAR(40) NOT NULL,        -- search, view_anon, unlock, reveal_pii, invite, dispute, login
  purpose         VARCHAR(160),
  ip              VARCHAR(45),
  meta            JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_company   ON access_logs (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_candidate ON access_logs (candidate_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_action    ON access_logs (action, created_at);

-- ── Disputas / reembolsos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id               SERIAL PRIMARY KEY,
  unlock_id        INTEGER NOT NULL REFERENCES unlocks(id) ON DELETE CASCADE,
  company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reason           VARCHAR(40) NOT NULL
                     CHECK (reason IN ('invalid_contact','no_response','outdated','not_eligible','quality')),
  status           VARCHAR(20) NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','approved','rejected')),
  resolution       VARCHAR(40),                -- refund_full, refund_partial, denied
  credits_returned INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_disputes_company ON disputes (company_id, created_at);

-- ── Colunas B2B em candidates (Identity Vault / responsividade) ──
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS visibility        VARCHAR(20) DEFAULT 'visible'
  CHECK (visibility IN ('visible','anonymous','hidden'));
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS b2b_consent       BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS b2b_consent_at    TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone_verified    BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_min        INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_max        INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_model        VARCHAR(20);   -- remoto/hibrido/presencial
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS availability      VARCHAR(30);   -- imediata/30d/60d/90d
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS skills            JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS area              VARCHAR(80);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS public_token      VARCHAR(64);   -- pseudônimo opaco
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS responses_received INTEGER DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS invites_total      INTEGER DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS confirm_token      VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_public_token ON candidates (public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_visibility ON candidates (visibility);
CREATE INDEX IF NOT EXISTS idx_candidates_confirmed  ON candidates (last_confirmed_at);

-- backfill: gera pseudônimo para quem ainda não tem
UPDATE candidates SET public_token = encode(gen_random_bytes(16), 'hex')
WHERE public_token IS NULL;

-- updated_at triggers (reaproveita função set_updated_at de _schema.sql)
DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_company_users_updated_at ON company_users;
CREATE TRIGGER trg_company_users_updated_at BEFORE UPDATE ON company_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_unlocks_updated_at ON unlocks;
CREATE TRIGGER trg_unlocks_updated_at BEFORE UPDATE ON unlocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Proteção da auditoria: bloqueia UPDATE/DELETE em access_logs (append-only)
CREATE OR REPLACE FUNCTION block_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'access_logs é append-only (imutável)';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_logs_immutable ON access_logs;
CREATE TRIGGER trg_logs_immutable BEFORE UPDATE OR DELETE ON access_logs
  FOR EACH ROW EXECUTE FUNCTION block_mutation();

-- ── Pedidos de compra de créditos (checkout Mercado Pago) ────
-- Rastreia cada compra para creditar de forma idempotente via webhook.
CREATE TABLE IF NOT EXISTS credit_orders (
  id                 SERIAL PRIMARY KEY,
  company_id         INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package            VARCHAR(20) NOT NULL,
  credits            INTEGER NOT NULL,
  price              NUMERIC(10,2) NOT NULL,
  external_reference VARCHAR(80) NOT NULL UNIQUE,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','paid','failed','canceled')),
  mp_preference_id   VARCHAR(80),
  mp_payment_id      VARCHAR(80),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  paid_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_credit_orders_company ON credit_orders (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_orders_extref  ON credit_orders (external_reference);
