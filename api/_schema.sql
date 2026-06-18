-- ═══════════════════════════════════════════════════════════
-- Entre Escolhas — Schema Postgres (Supabase)
-- Rode este script UMA VEZ no SQL Editor do Supabase (Project > SQL Editor)
-- Equivalente ao antigo setup.php (MySQL), agora em Postgres.
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS candidates (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL UNIQUE,
  telefone         VARCHAR(30),
  cidade           VARCHAR(120),
  linkedin         VARCHAR(255),
  objetivo         VARCHAR(80),
  cargo            VARCHAR(150),
  empresa          VARCHAR(150),
  experiencia      VARCHAR(80),
  escolaridade     VARCHAR(80),
  senioridade      VARCHAR(80),
  arquetipo        VARCHAR(80),
  arquetipo_scores JSONB,
  pcd              BOOLEAN DEFAULT FALSE,
  pcd_tipo         VARCHAR(120),
  status           VARCHAR(20) NOT NULL DEFAULT 'novo'
                     CHECK (status IN ('novo','triagem','entrevista','aprovado','arquivado')),
  notes            TEXT,
  source           VARCHAR(80) DEFAULT 'banco-de-talentos',
  consents         JSONB,
  tags             JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_candidates_status   ON candidates (status);
CREATE INDEX IF NOT EXISTS idx_candidates_objetivo ON candidates (objetivo);
CREATE INDEX IF NOT EXISTS idx_candidates_created  ON candidates (created_at);

CREATE TABLE IF NOT EXISTS candidate_notes (
  id           SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  note         TEXT NOT NULL,
  author       VARCHAR(120) DEFAULT 'admin',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_status_log (
  id           SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  from_status  VARCHAR(40),
  to_status    VARCHAR(40),
  changed_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  jornada          VARCHAR(40) NOT NULL DEFAULT 'arquetipo',
  confirm_token    VARCHAR(64) NOT NULL,
  confirmed_at     TIMESTAMPTZ,
  access_token     VARCHAR(64) NOT NULL UNIQUE,
  attempts_used    SMALLINT NOT NULL DEFAULT 0,
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN ('pending','paid','failed')),
  mp_preference_id VARCHAR(80),
  mp_payment_id    VARCHAR(80),
  report_json      JSONB,
  report_sent_at   TIMESTAMPTZ,
  ip               VARCHAR(45),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (email, jornada)
);
CREATE INDEX IF NOT EXISTS idx_leads_confirm_token ON leads (confirm_token);
CREATE INDEX IF NOT EXISTS idx_leads_email         ON leads (email);

-- Trigger genérico para manter updated_at em dia (substitui "ON UPDATE CURRENT_TIMESTAMP" do MySQL)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidates_updated_at ON candidates;
CREATE TRIGGER trg_candidates_updated_at BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Rate limiting por IP (substitui os arquivos temporários do PHP, que não
-- persistem entre invocações serverless)
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id         SERIAL PRIMARY KEY,
  ip         VARCHAR(45) NOT NULL,
  route      VARCHAR(60) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON rate_limit_hits (ip, route, created_at);
