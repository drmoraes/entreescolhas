-- ── Registro de tentativas de teste ──────────────────────────
-- 1 linha por CONCLUSÃO de teste (histórico completo, imutável na prática).
-- A tabela leads guarda o "estado atual" (última tentativa + report_json);
-- test_attempts guarda o histórico de todas as tentativas para auditoria/relatórios.
CREATE TABLE IF NOT EXISTS test_attempts (
  id           SERIAL PRIMARY KEY,
  lead_id      INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  jornada      VARCHAR(40) NOT NULL,
  attempt_no   SMALLINT NOT NULL,
  report_json  JSONB,
  arquetipo    VARCHAR(120),
  paid         BOOLEAN NOT NULL DEFAULT FALSE,
  ip           VARCHAR(45),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_test_attempts_lead    ON test_attempts (lead_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_jornada ON test_attempts (jornada);
CREATE INDEX IF NOT EXISTS idx_test_attempts_created ON test_attempts (created_at DESC);

-- marca de quando o teste foi reiniciado pelo admin (para auditoria leve no próprio lead)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reset_count   SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ;
