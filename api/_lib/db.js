// Conexão Postgres (Supabase) — reaproveitada entre invocações da função serverless.
const { Pool } = require('pg');

let pool;

function getDB() {
  if (!pool) {
    // Prioriza SUPABASE_DB_URL (não é gerenciada por integração) e cai para DATABASE_URL.
    const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não configurada');
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

// Helper simples para queries parametrizadas — devolve { rows, rowCount }
async function query(text, params = []) {
  const db = getDB();
  return db.query(text, params);
}

module.exports = { getDB, query };
