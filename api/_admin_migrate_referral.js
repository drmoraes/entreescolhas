// GET/POST /api/b2b?fn=admin_migrate_referral — cria as tabelas do Programa de
// Afiliados e Recompensas (v2.0) e semeia os parâmetros em app_settings.
// Idempotente. Protegido por ADMIN_API_KEY. Espelha cashback/schema_cashback.sql.
const { setCors, json, err, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');

const STATEMENTS = [
  // ── Parâmetros configuráveis ─────────────────────────────
  `INSERT INTO app_settings (key, value, updated_at) VALUES
     ('price_single','9.90',NOW()),
     ('price_combo','19.90',NOW()),
     ('referral_discount_pct','10',NOW()),
     ('referral_commission_pct','15',NOW()),
     ('cashback_window_days','8',NOW()),
     ('cashback_window_card','40',NOW()),
     ('cashback_min_payout','20.00',NOW()),
     ('referral_enabled','1',NOW())
   ON CONFLICT (key) DO NOTHING`,

  // ── Pedidos (orders) ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS purchases (
     id               SERIAL PRIMARY KEY,
     email            VARCHAR(255) NOT NULL,
     lead_id          INTEGER REFERENCES leads(id),
     kind             VARCHAR(10) NOT NULL DEFAULT 'single' CHECK (kind IN ('single','combo')),
     jornada          VARCHAR(40),
     amount           NUMERIC(10,2) NOT NULL,
     discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
     coupon_code      VARCHAR(40),
     referred_by_code VARCHAR(20),
     payment_method   VARCHAR(20),
     status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','failed')),
     mp_payment_id    VARCHAR(80),
     paid_at          TIMESTAMPTZ,
     refunded_at      TIMESTAMPTZ,
     created_at       TIMESTAMPTZ DEFAULT NOW(),
     updated_at       TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_purchases_email   ON purchases (email)`,
  `CREATE INDEX IF NOT EXISTS idx_purchases_status  ON purchases (status)`,
  `CREATE INDEX IF NOT EXISTS idx_purchases_mp      ON purchases (mp_payment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_purchases_refcode ON purchases (referred_by_code)`,

  // ── Códigos de afiliado (1 por e-mail) ───────────────────
  `CREATE TABLE IF NOT EXISTS referral_codes (
     id           SERIAL PRIMARY KEY,
     code         VARCHAR(20) NOT NULL UNIQUE,
     owner_email  VARCHAR(255) NOT NULL UNIQUE,
     owner_name   VARCHAR(255),
     cpf          VARCHAR(14),
     pix_key      VARCHAR(140),
     pix_key_type VARCHAR(20),
     created_at   TIMESTAMPTZ DEFAULT NOW(),
     updated_at   TIMESTAMPTZ DEFAULT NOW())`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(20)`,
  `CREATE INDEX IF NOT EXISTS idx_leads_referred_by ON leads (referred_by_code)`,

  // ── Comissões (ledger) ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS affiliate_commissions (
     id               SERIAL PRIMARY KEY,
     referrer_code    VARCHAR(20) NOT NULL,
     referrer_email   VARCHAR(255) NOT NULL,
     purchase_id      INTEGER NOT NULL REFERENCES purchases(id),
     referred_email   VARCHAR(255) NOT NULL,
     purchase_amount  NUMERIC(10,2) NOT NULL,
     commission_pct   NUMERIC(5,2) NOT NULL,
     commission_amount NUMERIC(10,2) NOT NULL,
     status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','released','paid','cancelled')),
     paid_purchase_at TIMESTAMPTZ NOT NULL,
     release_at       TIMESTAMPTZ NOT NULL,
     released_at      TIMESTAMPTZ,
     cancelled_at     TIMESTAMPTZ,
     cancel_reason    VARCHAR(140),
     payout_id        INTEGER,
     created_at       TIMESTAMPTZ DEFAULT NOW(),
     updated_at       TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE (purchase_id))`,
  `CREATE INDEX IF NOT EXISTS idx_comm_refcode ON affiliate_commissions (referrer_code)`,
  `CREATE INDEX IF NOT EXISTS idx_comm_status  ON affiliate_commissions (status)`,
  `CREATE INDEX IF NOT EXISTS idx_comm_release ON affiliate_commissions (release_at)`,

  // Recuperação de comissão já paga quando a compra original é estornada depois do payout.
  `ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS clawback_due BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE affiliate_commissions ADD COLUMN IF NOT EXISTS clawback_note VARCHAR(140)`,
  `CREATE INDEX IF NOT EXISTS idx_comm_clawback ON affiliate_commissions (clawback_due) WHERE clawback_due`,

  // ── Lotes de pagamento Pix (fila manual) ─────────────────
  `CREATE TABLE IF NOT EXISTS affiliate_payouts (
     id           SERIAL PRIMARY KEY,
     owner_email  VARCHAR(255) NOT NULL,
     owner_name   VARCHAR(255),
     cpf          VARCHAR(14),
     pix_key      VARCHAR(140),
     pix_key_type VARCHAR(20),
     amount       NUMERIC(10,2) NOT NULL,
     status       VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','paid','failed','cancelled')),
     requested_at TIMESTAMPTZ DEFAULT NOW(),
     paid_at      TIMESTAMPTZ,
     paid_by      VARCHAR(255),
     tx_note      VARCHAR(255),
     created_at   TIMESTAMPTZ DEFAULT NOW(),
     updated_at   TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE INDEX IF NOT EXISTS idx_payouts_status ON affiliate_payouts (status)`,

  // ── Aceite do regulamento (prova jurídica) ───────────────
  `CREATE TABLE IF NOT EXISTS affiliate_terms (
     id            SERIAL PRIMARY KEY,
     email         VARCHAR(255) NOT NULL,
     code          VARCHAR(20),
     terms_version VARCHAR(20) NOT NULL,
     accepted_at   TIMESTAMPTZ DEFAULT NOW(),
     ip            VARCHAR(45),
     user_agent    VARCHAR(255))`,
  `CREATE INDEX IF NOT EXISTS idx_terms_email ON affiliate_terms (email)`,

  // ── Triggers updated_at (reusa set_updated_at do schema base) ─
  `DROP TRIGGER IF EXISTS trg_purchases_updated_at ON purchases`,
  `CREATE TRIGGER trg_purchases_updated_at BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
  `DROP TRIGGER IF EXISTS trg_refcodes_updated_at ON referral_codes`,
  `CREATE TRIGGER trg_refcodes_updated_at BEFORE UPDATE ON referral_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
  `DROP TRIGGER IF EXISTS trg_comm_updated_at ON affiliate_commissions`,
  `CREATE TRIGGER trg_comm_updated_at BEFORE UPDATE ON affiliate_commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
  `DROP TRIGGER IF EXISTS trg_payouts_updated_at ON affiliate_payouts`,
  `CREATE TRIGGER trg_payouts_updated_at BEFORE UPDATE ON affiliate_payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
];

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;

  const done = [];
  for (const sql of STATEMENTS) {
    try {
      await query(sql);
      done.push(sql.slice(0, 60).replace(/\s+/g, ' ') + '…');
    } catch (e) {
      return err(res, `Falha na migração: ${e.message} | SQL: ${sql.slice(0, 80)}`, 500);
    }
  }
  return json(res, { ok: true, applied: done.length, statements: done });
};
