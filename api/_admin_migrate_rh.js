// GET/POST /api/b2b?fn=admin_migrate_rh — colunas de categoria/setores nos
// candidatos + parâmetros de custo de crédito por categoria. Idempotente.
const { setCors, json, err, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');

const STATEMENTS = [
  // categoria do cargo (define o custo de desbloqueio) e setores de experiência
  `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS categoria VARCHAR(20)`,   // operacional|analista|especialista|gerencial
  `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS setores JSONB`,           // ['varejo','farmacia','servicos',...]
  `CREATE INDEX IF NOT EXISTS idx_candidates_categoria ON candidates (categoria)`,
  `CREATE INDEX IF NOT EXISTS idx_candidates_pcd ON candidates (pcd)`,

  // custos de crédito por categoria (parametrizáveis no admin)
  `INSERT INTO app_settings (key, value, updated_at) VALUES
     ('credit_cost_operacional','1',NOW()),
     ('credit_cost_analista','4',NOW()),
     ('credit_cost_especialista','4',NOW()),
     ('credit_cost_gerencial','6',NOW()),
     ('credit_cost_pcd','8',NOW())
   ON CONFLICT (key) DO NOTHING`,
];

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const done = [];
  for (const sql of STATEMENTS) {
    try { await query(sql); done.push(sql.slice(0, 56).replace(/\s+/g, ' ') + '…'); }
    catch (e) { return err(res, `Falha na migração RH: ${e.message} | SQL: ${sql.slice(0, 80)}`, 500); }
  }
  return json(res, { ok: true, applied: done.length, statements: done });
};
