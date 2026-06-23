-- ============================================================================
-- Entre Escolhas — Schema do Programa de Afiliados e Recompensas + Combo (v2.0)
-- Postgres (Neon em produção). Idempotente: pode rodar mais de uma vez.
-- Roda DEPOIS de api/_schema.sql (depende da tabela leads).
--
-- ⚠️ FONTE CANÔNICA EM PRODUÇÃO: api/_admin_migrate_referral.js (rodado pelo
--    admin em /painel.html#afiliados → "Instalar/migrar tabelas"). Este arquivo
--    é a referência legível; mantenha os dois em sincronia. A v2.0 usa
--    comissão de 15% (indicador) + desconto de 10% (indicado), comissão só via Pix.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Parâmetros configuráveis (admin) — reaproveita app_settings (key/value)
--    Os valores ficam editáveis no painel admin, com fallback no código.
-- ----------------------------------------------------------------------------
INSERT INTO app_settings (key, value, updated_at) VALUES
  ('price_single',          '9.90',  NOW()),  -- preço do teste avulso
  ('price_combo',           '19.90', NOW()),  -- preço do combo (todos os testes)
  ('referral_discount_pct', '10',    NOW()),  -- % de desconto do indicado
  ('referral_commission_pct','15',   NOW()),  -- % de comissão do indicador
  ('cashback_window_days',  '8',     NOW()),  -- janela CDC antes de liberar (dias)
  ('cashback_min_payout',   '20.00', NOW()),  -- valor mínimo para saque via Pix
  ('referral_enabled',      '1',     NOW())   -- liga/desliga o programa
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1) Pedidos (orders) — registra cada compra paga (avulso ou combo).
--    Centraliza a liberação de acesso e a base do cashback.
--    leads.payment_status continua existindo p/ compatibilidade do avulso.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchases (
  id                SERIAL PRIMARY KEY,
  email             VARCHAR(255) NOT NULL,
  lead_id           INTEGER REFERENCES leads(id),          -- jornada de origem da compra
  kind              VARCHAR(10) NOT NULL DEFAULT 'single'  -- 'single' | 'combo'
                      CHECK (kind IN ('single','combo')),
  jornada           VARCHAR(40),                           -- preenchido só quando kind='single'
  amount            NUMERIC(10,2) NOT NULL,                -- valor líquido efetivamente pago
  coupon_code       VARCHAR(40),                           -- cupom aplicado (se houver)
  referred_by_code  VARCHAR(20),                           -- código de indicação usado na compra
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','paid','refunded','failed')),
  mp_payment_id     VARCHAR(80),
  paid_at           TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchases_email  ON purchases (email);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases (status);
CREATE INDEX IF NOT EXISTS idx_purchases_refcode ON purchases (referred_by_code);

-- Entitlement (o que cada e-mail desbloqueou):
--   - kind='combo' pago  => acesso a TODAS as jornadas
--   - kind='single' pago => acesso à jornada daquela compra
-- A checagem é feita por query (sem tabela extra). Ex.:
--   SELECT 1 FROM purchases
--    WHERE email=$1 AND status='paid'
--      AND (kind='combo' OR (kind='single' AND jornada=$2)) LIMIT 1;

-- ----------------------------------------------------------------------------
-- 2) Códigos de indicação — 1 código por pessoa (e-mail).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_codes (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(20) NOT NULL UNIQUE,        -- ex.: 'MARIA7K2' (gerar curto e único)
  owner_email  VARCHAR(255) NOT NULL UNIQUE,       -- dono do código
  owner_name   VARCHAR(255),
  -- dados de recebimento (preenchidos quando o indicador for sacar):
  cpf          VARCHAR(14),
  pix_key      VARCHAR(140),
  pix_key_type VARCHAR(20),                         -- 'cpf'|'email'|'telefone'|'aleatoria'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Atribuição da indicação direto no lead que chega via ?ref=CODE
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_leads_referred_by ON leads (referred_by_code);

-- ----------------------------------------------------------------------------
-- 3) Razão (ledger) do cashback — uma linha por compra que gera cashback.
--    Fluxo de status: pending -> released -> paid  (ou -> cancelled)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashback_ledger (
  id              SERIAL PRIMARY KEY,
  referrer_code   VARCHAR(20) NOT NULL,             -- quem recebe (FK lógica -> referral_codes.code)
  referrer_email  VARCHAR(255) NOT NULL,
  purchase_id     INTEGER NOT NULL REFERENCES purchases(id),
  referred_email  VARCHAR(255) NOT NULL,            -- quem comprou
  purchase_amount NUMERIC(10,2) NOT NULL,
  cashback_pct    NUMERIC(5,2) NOT NULL,            -- % aplicado (snapshot na hora)
  cashback_amount NUMERIC(10,2) NOT NULL,           -- valor do cashback
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','released','paid','cancelled')),
  paid_purchase_at TIMESTAMPTZ NOT NULL,            -- quando a compra foi confirmada
  release_at       TIMESTAMPTZ NOT NULL,            -- paid_purchase_at + janela (8 dias)
  released_at      TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  cancel_reason    VARCHAR(140),
  payout_id        INTEGER,                          -- vínculo com o lote de pagamento
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (purchase_id)                               -- 1 cashback por compra
);
CREATE INDEX IF NOT EXISTS idx_cashback_refcode ON cashback_ledger (referrer_code);
CREATE INDEX IF NOT EXISTS idx_cashback_status  ON cashback_ledger (status);
CREATE INDEX IF NOT EXISTS idx_cashback_release ON cashback_ledger (release_at);

-- ----------------------------------------------------------------------------
-- 4) Lotes de pagamento Pix (fila manual do admin).
--    O owner/admin paga pelo banco/MP e marca como 'paid' aqui.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashback_payouts (
  id           SERIAL PRIMARY KEY,
  owner_email  VARCHAR(255) NOT NULL,
  owner_name   VARCHAR(255),
  cpf          VARCHAR(14),
  pix_key      VARCHAR(140),
  pix_key_type VARCHAR(20),
  amount       NUMERIC(10,2) NOT NULL,              -- soma dos ledgers liberados
  status       VARCHAR(20) NOT NULL DEFAULT 'requested'
                 CHECK (status IN ('requested','paid','failed','cancelled')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at      TIMESTAMPTZ,
  paid_by      VARCHAR(255),                        -- admin que confirmou
  tx_note      VARCHAR(255),                        -- ID/comprovante do Pix
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON cashback_payouts (status);

-- ----------------------------------------------------------------------------
-- 5) Registro de aceite do Regulamento (prova jurídica).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashback_terms_accept (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  code           VARCHAR(20),
  terms_version  VARCHAR(20) NOT NULL,              -- ex.: '1.0'
  accepted_at    TIMESTAMPTZ DEFAULT NOW(),
  ip             VARCHAR(45),
  user_agent     VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_terms_email ON cashback_terms_accept (email);

-- ----------------------------------------------------------------------------
-- 6) Triggers de updated_at (reaproveita função set_updated_at do schema base)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_purchases_updated_at ON purchases;
CREATE TRIGGER trg_purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_referral_codes_updated_at ON referral_codes;
CREATE TRIGGER trg_referral_codes_updated_at BEFORE UPDATE ON referral_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cashback_ledger_updated_at ON cashback_ledger;
CREATE TRIGGER trg_cashback_ledger_updated_at BEFORE UPDATE ON cashback_ledger
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cashback_payouts_updated_at ON cashback_payouts;
CREATE TRIGGER trg_cashback_payouts_updated_at BEFORE UPDATE ON cashback_payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Consultas de apoio (referência para o admin / cron):
--
--  -- Liberar cashbacks cujo prazo venceu sem estorno (rodar no cron diário):
--  UPDATE cashback_ledger
--     SET status='released', released_at=NOW()
--   WHERE status='pending' AND release_at <= NOW();
--
--  -- Saldo liberado e disponível por indicador:
--  SELECT referrer_email, SUM(cashback_amount) AS disponivel
--    FROM cashback_ledger WHERE status='released' AND payout_id IS NULL
--   GROUP BY referrer_email;
--
--  -- Quem indicou + % a reembolsar (visão do admin):
--  SELECT c.referrer_email, c.referrer_code, c.referred_email,
--         c.purchase_amount, c.cashback_pct, c.cashback_amount,
--         c.status, c.release_at
--    FROM cashback_ledger c
--   ORDER BY c.created_at DESC;
-- ============================================================================
