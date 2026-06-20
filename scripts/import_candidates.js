#!/usr/bin/env node
// Importa candidatos de um CSV para a tabela `candidates`.
// Uso:  DATABASE_URL="postgres://..." node scripts/import_candidates.js caminho/arquivo.csv
// Geocodifica o CEP (BrasilAPI) para lat/lon e gera tokens/pseudônimo automaticamente.
// Idempotente por e-mail (re-importar atualiza).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

// ── connection string (env ou .env.local) ───────────────────
(function loadEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
})();
function findConn() {
  const isPg = (v) => typeof v === 'string' && /^postgres(ql)?:\/\//i.test(v.replace(/^["']/, ''));
  for (const k of ['DATABASE_URL','POSTGRES_URL','DATABASE_POSTGRES_URL','DATABASE_URL_UNPOOLED','DATABASE_POSTGRES_URL_NON_POOLING'])
    if (isPg(process.env[k])) return process.env[k].replace(/^["']|["']$/g, '');
  for (const [k, v] of Object.entries(process.env)) if (isPg(v) && !/PRISMA/i.test(k)) return v.replace(/^["']|["']$/g, '');
  return null;
}

// ── parser CSV (aspas, vírgulas, escape "") ──────────────────
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* ignora */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const norm = (s) => String(s || '').trim();
const lower = (s) => norm(s).toLowerCase();
const bool = (s) => /^(true|1|sim|s|yes|y)$/i.test(norm(s));
const num = (s) => { const n = parseInt(String(s).replace(/\D/g, ''), 10); return isNaN(n) ? null : n; };
const list = (s) => norm(s) ? norm(s).split(/[;|]/).map((x) => x.trim()).filter(Boolean) : [];
const tok = () => crypto.randomBytes(16).toString('hex');

// ── geocodificação de CEP (BrasilAPI v2) com cache ───────────
const geoCache = new Map();
async function geocodeCEP(cep) {
  const clean = String(cep || '').replace(/\D/g, '');
  if (clean.length !== 8) return { lat: null, lon: null };
  if (geoCache.has(clean)) return geoCache.get(clean);
  let out = { lat: null, lon: null };
  try {
    const r = await fetch('https://brasilapi.com.br/api/cep/v2/' + clean);
    if (r.ok) {
      const j = await r.json();
      const co = j.location && j.location.coordinates;
      if (co && co.latitude) out = { lat: Number(co.latitude), lon: Number(co.longitude) };
    }
  } catch (_) {}
  geoCache.set(clean, out);
  await new Promise((res) => setTimeout(res, 120)); // gentileza com a API
  return out;
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('Uso: node scripts/import_candidates.js arquivo.csv'); process.exit(1); }
  const url = findConn();
  if (!url) { console.error('✗ Sem DATABASE_URL. Rode: DATABASE_URL="..." node scripts/import_candidates.js arquivo.csv'); process.exit(1); }

  const rows = parseCSV(fs.readFileSync(path.resolve(file), 'utf8'));
  if (rows.length < 2) { console.error('CSV vazio ou só com cabeçalho.'); process.exit(1); }
  const header = rows[0].map((h) => lower(h));
  const col = (r, name) => { const i = header.indexOf(name); return i >= 0 ? r[i] : ''; };

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Importando ${rows.length - 1} candidatos...\n`);

  let ok = 0, skip = 0, geo = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const email = lower(col(r, 'email'));
    const nome = norm(col(r, 'nome'));
    if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skip++; continue; }

    const cep = norm(col(r, 'cep'));
    const { lat, lon } = await geocodeCEP(cep);
    if (lat != null) geo++;

    const vals = {
      nome, email,
      telefone: norm(col(r, 'telefone')),
      cidade: norm(col(r, 'cidade')),
      cep: cep || null,
      lat, lon,
      linkedin: norm(col(r, 'linkedin')),
      cargo: norm(col(r, 'cargo')),
      empresa: norm(col(r, 'empresa')),
      area: norm(col(r, 'area')),
      senioridade: lower(col(r, 'senioridade')),
      experiencia: norm(col(r, 'experiencia')),
      escolaridade: norm(col(r, 'escolaridade')),
      work_model: lower(col(r, 'work_model')) || null,
      availability: lower(col(r, 'availability')) || null,
      salary_min: num(col(r, 'salary_min')),
      salary_max: num(col(r, 'salary_max')),
      skills: JSON.stringify(list(col(r, 'skills'))),
      idiomas: JSON.stringify(list(col(r, 'idiomas'))),
      aceita_relocacao: norm(col(r, 'aceita_relocacao')) ? bool(col(r, 'aceita_relocacao')) : null,
      contrato: lower(col(r, 'contrato')) || null,
      arquetipo: norm(col(r, 'arquetipo')) || null,
      b2b_consent: bool(col(r, 'b2b_consent')),
      email_verified: norm(col(r, 'email_verified')) ? bool(col(r, 'email_verified')) : false,
      phone_verified: norm(col(r, 'phone_verified')) ? bool(col(r, 'phone_verified')) : false,
    };

    await client.query(
      `INSERT INTO candidates
        (nome,email,telefone,cidade,cep,lat,lon,linkedin,cargo,empresa,area,senioridade,experiencia,escolaridade,
         work_model,availability,salary_min,salary_max,skills,idiomas,aceita_relocacao,contrato,arquetipo,
         b2b_consent,b2b_consent_at,email_verified,phone_verified,visibility,last_confirmed_at,
         public_token,confirm_token,status,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
               $24, CASE WHEN $24 THEN NOW() END, $25,$26,'visible',NOW(),$27,$28,'novo','import-csv')
       ON CONFLICT (email) DO UPDATE SET
         nome=EXCLUDED.nome, telefone=EXCLUDED.telefone, cidade=EXCLUDED.cidade, cep=EXCLUDED.cep,
         lat=EXCLUDED.lat, lon=EXCLUDED.lon, linkedin=EXCLUDED.linkedin, cargo=EXCLUDED.cargo, empresa=EXCLUDED.empresa,
         area=EXCLUDED.area, senioridade=EXCLUDED.senioridade, experiencia=EXCLUDED.experiencia, escolaridade=EXCLUDED.escolaridade,
         work_model=EXCLUDED.work_model, availability=EXCLUDED.availability, salary_min=EXCLUDED.salary_min, salary_max=EXCLUDED.salary_max,
         skills=EXCLUDED.skills, idiomas=EXCLUDED.idiomas, aceita_relocacao=EXCLUDED.aceita_relocacao, contrato=EXCLUDED.contrato,
         arquetipo=EXCLUDED.arquetipo, b2b_consent=EXCLUDED.b2b_consent, email_verified=EXCLUDED.email_verified,
         phone_verified=EXCLUDED.phone_verified, updated_at=NOW()`,
      [vals.nome, vals.email, vals.telefone, vals.cidade, vals.cep, vals.lat, vals.lon, vals.linkedin, vals.cargo,
       vals.empresa, vals.area, vals.senioridade, vals.experiencia, vals.escolaridade, vals.work_model, vals.availability,
       vals.salary_min, vals.salary_max, vals.skills, vals.idiomas, vals.aceita_relocacao, vals.contrato, vals.arquetipo,
       vals.b2b_consent, vals.email_verified, vals.phone_verified, tok(), tok()]
    );
    ok++;
    if (ok % 50 === 0) process.stdout.write(`  ${ok} importados...\n`);
  }
  // garante pseudônimo p/ quem não tinha
  await client.query("UPDATE candidates SET public_token = encode(gen_random_bytes(16),'hex') WHERE public_token IS NULL");
  const total = await client.query('SELECT COUNT(*)::int n FROM candidates WHERE b2b_consent');
  await client.end();
  console.log(`\n✅ ${ok} importados, ${skip} pulados (sem nome/e-mail válido), ${geo} geocodificados.`);
  console.log(`   Total de candidatos consentidos no banco: ${total.rows[0].n}`);
}

main().catch((e) => { console.error('✗ ERRO:', e.message); process.exit(1); });
