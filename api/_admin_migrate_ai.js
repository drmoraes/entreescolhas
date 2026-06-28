// GET/POST /api/b2b?fn=admin_migrate_ai — coluna usada pelo Diagnóstico de
// Coaching Comportamental (cache do resultado, vindo de IA ou do modelo
// determinístico). Idempotente. Protegido por ADMIN_API_KEY.
const { setCors, json, err, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');

const STATEMENTS = [
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_diagnostico_json JSONB`,
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
