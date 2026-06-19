#!/usr/bin/env node
// Seed de demonstração do Banco de Talentos B2B.
//   node scripts/seed_b2b.js
// Cria empresa demo + usuário, e enriquece/insere candidatos com campos B2B.
// Requer DATABASE_URL no ambiente. Idempotente (usa upserts por e-mail/token).
const path = require('path');
const { query, getDB } = require(path.join(__dirname, '..', 'api', '_lib', 'db'));
const { hashPassword } = require(path.join(__dirname, '..', 'api', '_lib', 'b2b-auth'));
const crypto = require('crypto');
const tok = () => crypto.randomBytes(16).toString('hex');

const AREAS = ['Tecnologia', 'Dados', 'Produto', 'Design', 'Marketing', 'Vendas'];
const SENIOR = ['junior', 'pleno', 'senior', 'especialista'];
const CIDADES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Remoto'];
const MODELS = ['remoto', 'hibrido', 'presencial'];
const AVAIL = ['imediata', '30d', '60d', '90d'];
const SKILLS = {
  Tecnologia: ['React', 'Node', 'TypeScript', 'Python', 'AWS', 'Docker', 'PostgreSQL', 'Go'],
  Dados: ['SQL', 'Python', 'Power BI', 'Spark', 'dbt', 'Machine Learning', 'ETL'],
  Produto: ['Discovery', 'Roadmap', 'Analytics', 'A/B Test', 'Figma', 'OKR'],
  Design: ['Figma', 'UX Research', 'Design System', 'Prototipagem', 'UI'],
  Marketing: ['SEO', 'Growth', 'Performance', 'Conteúdo', 'CRM', 'Mídia Paga'],
  Vendas: ['SDR', 'Closer', 'CRM', 'Inbound', 'Outbound', 'Negociação'],
};
const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Felipe', 'Gabi', 'Hugo', 'Isa', 'João',
  'Kelly', 'Lucas', 'Marina', 'Nina', 'Otto', 'Paula', 'Rafa', 'Sofia', 'Tiago', 'Vera'];
const SOBRE = ['Silva', 'Souza', 'Costa', 'Lima', 'Alves', 'Rocha', 'Pereira', 'Gomes', 'Dias', 'Melo'];
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
const daysAgo = (d) => new Date(Date.now() - d * 86400000);

async function main() {
  console.log('→ Seed B2B iniciado');

  // 1) Empresa demo + usuário owner
  let comp = await query("SELECT id FROM companies WHERE email = 'demo@empresa.com'");
  let companyId;
  if (comp.rows[0]) {
    companyId = comp.rows[0].id;
    console.log('  empresa demo já existe (#' + companyId + ')');
  } else {
    const r = await query(
      `INSERT INTO companies (nome, email, plan, status) VALUES ('Acme Talent (Demo)','demo@empresa.com','growth','ativa') RETURNING id`);
    companyId = r.rows[0].id;
    await query(
      `INSERT INTO company_users (company_id, nome, email, password_hash, role)
       VALUES ($1,'Recrutador Demo','demo@empresa.com',$2,'owner')`,
      [companyId, hashPassword('demo1234')]
    );
    const bal = await query('SELECT COALESCE(SUM(delta),0)::int s FROM credit_ledger WHERE company_id=$1', [companyId]);
    await query(
      `INSERT INTO credit_ledger (company_id, delta, reason, balance_after, meta)
       VALUES ($1,20,'bonus',$2,'{"desc":"créditos demo"}')`, [companyId, bal.rows[0].s + 20]);
    console.log('  empresa demo criada · login: demo@empresa.com / demo1234 · 20 créditos');
  }

  // 2) Garante massa de candidatos consentidos
  const cnt = await query("SELECT COUNT(*)::int n FROM candidates WHERE b2b_consent = TRUE");
  const have = cnt.rows[0].n;
  const target = 40;
  if (have >= target) {
    console.log(`  já há ${have} candidatos consentidos — pulando inserção`);
  } else {
    const toAdd = target - have;
    for (let i = 0; i < toAdd; i++) {
      const area = rand(AREAS);
      const sen = rand(SENIOR);
      const cidade = rand(CIDADES);
      const skills = sample(SKILLS[area], 3 + Math.floor(Math.random() * 3));
      const sMin = 3000 + Math.floor(Math.random() * 12) * 1000;
      const confDays = rand([2, 8, 20, 35, 60, 120]); // alguns frios de propósito
      const nome = `${rand(NOMES)} ${rand(SOBRE)}`;
      const email = `cand${Date.now()}_${i}@exemplo.dev`;
      await query(
        `INSERT INTO candidates
           (nome, email, telefone, cidade, cargo, area, senioridade, experiencia, escolaridade,
            work_model, availability, salary_min, salary_max, skills, arquetipo,
            email_verified, phone_verified, last_confirmed_at, b2b_consent, b2b_consent_at,
            visibility, public_token, confirm_token, status, source, invites_total, responses_received)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,TRUE,NOW(),
                 'visible',$19,$20,'novo','seed-b2b',$21,$22)`,
        [nome, email, '11' + (900000000 + Math.floor(Math.random() * 99999999)),
         cidade, `${area} ${sen}`, area, sen, `${1 + Math.floor(Math.random() * 12)} anos`, 'Ensino Superior',
         rand(MODELS), rand(AVAIL), sMin, sMin + 3000, JSON.stringify(skills), 'Arquiteto de Possibilidades',
         Math.random() > 0.15, Math.random() > 0.4, daysAgo(confDays), tok(), tok(),
         Math.floor(Math.random() * 5), Math.floor(Math.random() * 4)]
      );
    }
    console.log(`  +${toAdd} candidatos demo inseridos`);
  }

  // 3) Backfill de tokens/datas para candidatos legados sem campos B2B
  await query("UPDATE candidates SET public_token = encode(gen_random_bytes(16),'hex') WHERE public_token IS NULL");
  await query("UPDATE candidates SET confirm_token = encode(gen_random_bytes(16),'hex') WHERE confirm_token IS NULL");

  const sample2 = await query(
    "SELECT confirm_token, public_token FROM candidates WHERE b2b_consent = TRUE ORDER BY id DESC LIMIT 1");
  console.log('→ Seed concluído.');
  if (sample2.rows[0]) {
    console.log('  Token de candidato (portal): ' + sample2.rows[0].confirm_token);
  }
  await getDB().end();
}

main().catch((e) => { console.error('Seed falhou:', e); process.exit(1); });
