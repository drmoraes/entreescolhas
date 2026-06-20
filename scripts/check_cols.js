#!/usr/bin/env node
// Diagnóstico: confere se a tabela candidates tem todas as colunas que a busca usa
// e roda o MESMO SELECT do rh_search para capturar o erro real (se houver).
// Usa o DATABASE_URL do .env.local. Rode: node scripts/check_cols.js
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(function loadEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
})();

function findConn() {
  const isPg = (v) => typeof v === 'string' && /^postgres(ql)?:\/\//i.test(v);
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_POSTGRES_URL']) if (isPg(process.env[k])) return process.env[k];
  for (const [k, v] of Object.entries(process.env)) if (isPg(v) && !/PRISMA/i.test(k)) return v;
  return null;
}

// colunas exatas que o rh_search faz SELECT
const NEEDED = ['id','public_token','area','cargo','senioridade','experiencia','escolaridade',
  'cidade','work_model','availability','salary_min','salary_max','empresa','skills','arquetipo',
  'arquetipo_scores','last_confirmed_at','lat','lon','aceita_relocacao','email_verified',
  'phone_verified','invites_total','responses_received'];

(async () => {
  const url = findConn();
  if (!url) { console.error('✗ DATABASE_URL não encontrado no .env.local'); process.exit(1); }
  console.log('Banco:', url.replace(/:[^:@/]+@/, ':****@').slice(0, 60) + '...');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const cols = (await c.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='candidates'"
  )).rows.map(r => r.column_name);
  const missing = NEEDED.filter(n => !cols.includes(n));
  console.log('\nColunas que a busca exige e que ESTÃO FALTANDO:', missing.length ? missing.join(', ') : '(nenhuma) ✅');

  console.log('\nRodando o SELECT real da busca...');
  try {
    const r = await c.query(
      `SELECT id, public_token, area, cargo, senioridade, experiencia, escolaridade,
              cidade, work_model, availability, salary_min, salary_max, empresa,
              skills, arquetipo, arquetipo_scores, last_confirmed_at, lat, lon, aceita_relocacao,
              email_verified, phone_verified, invites_total, responses_received
         FROM candidates
        WHERE visibility <> 'hidden' AND b2b_consent = TRUE AND status NOT IN ('arquivado')
        LIMIT 5`);
    console.log('✅ SELECT funcionou. Linhas retornadas:', r.rows.length);
  } catch (e) {
    console.log('✗ ERRO no SELECT:', e.message);
  }
  await c.end();
})().catch(e => { console.error('ERRO geral:', e.message); process.exit(1); });
