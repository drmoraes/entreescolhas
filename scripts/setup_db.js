#!/usr/bin/env node
// Configura o banco de uma vez: roda _schema.sql + _schema_b2b.sql + seed_demo.sql.
// Usa o DATABASE_URL do .env.local (criado pelo `vercel env pull`) — nada de senha no código.
//   node scripts/setup_db.js
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// carrega variáveis do .env.local (se existir) sem sobrescrever as do ambiente
(function loadEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
})();

function findConnectionString() {
  const isPg = (v) => typeof v === 'string' && /^postgres(ql)?:\/\//i.test(v.replace(/^["']/, ''));
  // ordem de preferência por nome
  const prefer = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_POSTGRES_URL',
    'DATABASE_URL_UNPOOLED', 'DATABASE_POSTGRES_URL_NON_POOLING', 'POSTGRES_URL_NON_POOLING'];
  for (const k of prefer) if (isPg(process.env[k])) return process.env[k].replace(/^["']|["']$/g, '');
  // fallback: QUALQUER variável cujo valor seja uma URL postgres (evita as do Prisma/pgbouncer)
  for (const [k, v] of Object.entries(process.env)) {
    if (isPg(v) && !/PRISMA/i.test(k)) return v.replace(/^["']|["']$/g, '');
  }
  return null;
}

const url = findConnectionString();
if (!url) {
  console.error('✗ Nenhuma connection string Postgres encontrada no ambiente / .env.local.');
  console.error('  Rode antes: npx vercel env pull .env.local --environment=production');
  process.exit(1);
}
console.log('Usando connection string:', url.replace(/:[^:@/]+@/, ':****@').slice(0, 70) + '...');

const FILES = [
  'api/_schema.sql',        // tabelas base (candidates, leads, etc.)
  'api/_schema_b2b.sql',    // camada B2B (empresas, créditos, desbloqueios, auditoria)
  'scripts/seed_demo.sql',  // empresa demo + candidatos de teste
];

(async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Conectado ao banco. Aplicando schema...\n');
  for (const f of FILES) {
    const full = path.join(__dirname, '..', f);
    if (!fs.existsSync(full)) { console.log('  (pulando, não encontrado) ' + f); continue; }
    const sql = fs.readFileSync(full, 'utf8');
    process.stdout.write('→ ' + f + ' ... ');
    try {
      await client.query(sql); // pg aceita multi-statement quando não há parâmetros
      console.log('ok');
    } catch (e) {
      console.log('FALHOU');
      console.error('   ' + e.message);
    }
  }
  // confere
  const r = await client.query(
    "SELECT (SELECT COUNT(*) FROM company_users)::int AS usuarios, (SELECT COUNT(*) FROM candidates WHERE b2b_consent)::int AS candidatos");
  await client.end();
  console.log('\n✅ Pronto. Usuários RH: ' + r.rows[0].usuarios + ' | Candidatos consentidos: ' + r.rows[0].candidatos);
  console.log('   Login demo: demo@empresa.com / demo1234');
})().catch((e) => { console.error('\n✗ ERRO:', e.message); process.exit(1); });
