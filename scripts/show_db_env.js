#!/usr/bin/env node
// Diagnóstico: lista TODAS as variáveis de banco no .env.local (puxado da produção)
// e mostra, sem expor senha, qual host/projeto cada uma aponta.
// Rode: node scripts/show_db_env.js
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(p)) { console.error('✗ .env.local não existe'); process.exit(1); }

const env = {};
for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const isPg = (v) => typeof v === 'string' && /^postgres(ql)?:\/\//i.test(v);
const mask = (v) => {
  try {
    const u = new URL(v);
    const projeto = (u.username || '').split('.')[1] || u.username || '?';
    return `host=${u.hostname}:${u.port || ''}  user=${u.username}  projeto≈${projeto}`;
  } catch { return '(não parseável)'; }
};

const dbKeys = Object.keys(env).filter((k) => /DATABASE|POSTGRES|SUPABASE|NEON|PG/i.test(k));
console.log(`\nVariáveis de banco encontradas no .env.local (${dbKeys.length}):\n`);
let achouPg = false;
for (const k of dbKeys.sort()) {
  const v = env[k];
  if (isPg(v)) { achouPg = true; console.log(`  ✅ ${k}\n        ${mask(v)}`); }
  else console.log(`  ·  ${k} = ${v ? '(setado, não-postgres)' : '(vazio)'}`);
}
if (!achouPg) console.log('\n⚠️  NENHUMA variável tem valor postgres://. A conexão de produção não veio no pull.');

console.log('\nO que o db.js de produção usa: SUPABASE_DB_URL || DATABASE_URL');
console.log('  SUPABASE_DB_URL:', isPg(env.SUPABASE_DB_URL) ? '✅ '+mask(env.SUPABASE_DB_URL) : (env.SUPABASE_DB_URL ? '(setado, não-pg)' : '(ausente/vazio)'));
console.log('  DATABASE_URL:   ', isPg(env.DATABASE_URL) ? '✅ '+mask(env.DATABASE_URL) : (env.DATABASE_URL ? '(setado, não-pg)' : '(ausente/vazio)'));
