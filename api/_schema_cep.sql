-- ── Proximidade (CEP) ───────────────────────────────────────
-- cep = PII (só pós-desbloqueio). lat/lon derivados na importação (geocodificação).
-- Usados para calcular distância candidato↔vaga sem revelar a localização exata.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cep VARCHAR(9);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS idiomas JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS aceita_relocacao BOOLEAN;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS contrato VARCHAR(20);  -- clt/pj/tanto_faz
CREATE INDEX IF NOT EXISTS idx_candidates_geo ON candidates (lat, lon);
