-- ── Cupons & cortesias ───────────────────────────────────────
-- percent = desconto % no preço; credits = créditos cortesia adicionais.
CREATE TABLE IF NOT EXISTS coupons (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(40) NOT NULL UNIQUE,
  tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('percent','credits')),
  valor       NUMERIC(10,2) NOT NULL,          -- % (0-100) ou nº de créditos
  max_uses    INTEGER,                          -- NULL = ilimitado
  uses        INTEGER NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  status      VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','rascunho')),
  description VARCHAR(160),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id              SERIAL PRIMARY KEY,
  coupon_id       INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  company_id      INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  order_id        INTEGER,
  discount        NUMERIC(10,2),
  credits_granted INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_redemptions_coupon ON coupon_redemptions (coupon_id);

ALTER TABLE credit_orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(40);
ALTER TABLE credit_orders ADD COLUMN IF NOT EXISTS discount    NUMERIC(10,2);
