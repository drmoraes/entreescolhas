// Integração end-to-end com Postgres em memória (pg-mem).
// Exercita: busca anônima → desbloqueio (gasta crédito) → estorno automático
// por contato inválido → convite/SLA → resposta do candidato → disputa/reembolso.
// Rode: NODE_PATH=<outputs>/node_modules node tests/flow.test.js
const path = require('path');
const { newDb } = require('pg-mem');

const API = path.join(__dirname, '..', 'api');
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗ FAIL:', name); } }

// ── pg-mem backing a fake _lib/db ────────────────────────────
const db = newDb();
db.public.registerFunction({ name: 'now', returns: 'timestamptz', implementation: () => new Date() });
const pg = db.adapters.createPg();
const pool = new pg.Pool();

// injeta nosso pool no módulo db do projeto (antes de carregar handlers)
const dbPath = require.resolve(path.join(API, '_lib', 'db.js'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  getDB: () => pool,
  query: (text, params = []) => pool.query(text, params),
} };

const { hashPassword } = require(path.join(API, '_lib', 'b2b-auth'));

// ── schema mínimo (sem plpgsql/pgcrypto) ─────────────────────
async function setup() {
  await pool.query(`CREATE TABLE companies(id serial primary key, nome text, email text unique,
    plan text default 'trial', status text default 'ativa', reputation int default 100,
    created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE company_users(id serial primary key, company_id int, nome text, email text unique,
    password_hash text, role text default 'recruiter', session_token text, session_expires timestamptz,
    last_login timestamptz, created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE credit_ledger(id serial primary key, company_id int, delta int, reason text,
    ref_type text, ref_id int, balance_after int, meta jsonb, created_at timestamptz default now(), expires_at timestamptz)`);
  await pool.query(`CREATE TABLE candidates(id serial primary key, nome text, email text, telefone text, cidade text,
    linkedin text, cargo text, empresa text, area text, senioridade text, experiencia text, escolaridade text,
    work_model text, availability text, salary_min int, salary_max int, skills jsonb, arquetipo text, arquetipo_scores jsonb,
    status text default 'novo', visibility text default 'visible', b2b_consent boolean default false, b2b_consent_at timestamptz,
    last_confirmed_at timestamptz, email_verified boolean default false, phone_verified boolean default false,
    public_token text, confirm_token text, responses_received int default 0, invites_total int default 0, notes text)`);
  await pool.query(`CREATE TABLE unlocks(id serial primary key, company_id int, company_user_id int, candidate_id int,
    credits_spent int default 1, status text default 'active', contact_valid boolean, adherence_score int, confidence_score int,
    invited_at timestamptz, sla_deadline timestamptz, responded_at timestamptz, refunded_at timestamptz,
    created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE access_logs(id serial primary key, company_id int, company_user_id int, candidate_id int,
    action text, purpose text, ip text, meta jsonb, created_at timestamptz default now())`);
  await pool.query(`CREATE TABLE disputes(id serial primary key, unlock_id int, company_id int, reason text,
    status text default 'open', resolution text, credits_returned int default 0, notes text,
    created_at timestamptz default now(), resolved_at timestamptz)`);
  await pool.query(`CREATE TABLE rate_limit_hits(id serial primary key, ip text, route text, created_at timestamptz default now())`);

  // empresa + sessão + 5 créditos
  await pool.query(`INSERT INTO companies(nome,email,plan,status) VALUES('Demo','demo@x.com','growth','ativa')`);
  await pool.query(`INSERT INTO company_users(company_id,nome,email,password_hash,role,session_token,session_expires)
    VALUES(1,'R','demo@x.com',$1,'owner','SESS',now()+ interval '7 days')`, [hashPassword('demo1234')]);
  await pool.query(`INSERT INTO credit_ledger(company_id,delta,reason,balance_after) VALUES(1,5,'bonus',5)`);

  // candidato BOM (contato válido, ativo)
  await pool.query(`INSERT INTO candidates(nome,email,telefone,cidade,cargo,area,senioridade,work_model,availability,
    salary_min,salary_max,skills,b2b_consent,visibility,last_confirmed_at,email_verified,phone_verified,public_token,confirm_token,invites_total,responses_received)
    VALUES('Ana Silva','ana@mail.com','11999998888','São Paulo','Dev Pleno','Tecnologia','pleno','remoto','imediata',
    7000,9000,'["React","Node","AWS"]',true,'visible',now() - interval '5 days',true,true,'PUB_OK','CAND_OK',2,2)`);
  // candidato com contato INVÁLIDO (telefone curto, email quebrado)
  await pool.query(`INSERT INTO candidates(nome,email,telefone,cidade,cargo,area,senioridade,work_model,availability,
    salary_min,salary_max,skills,b2b_consent,visibility,last_confirmed_at,email_verified,public_token,confirm_token)
    VALUES('Bruno X','bruno-invalido','12',' Rio ','Dev','Tecnologia','junior','remoto','30d',
    5000,6000,'["React"]',true,'visible',now() - interval '10 days',false,'PUB_BAD','CAND_BAD')`);
}

// fakes de req/res
function mkReq({ method = 'GET', query = {}, body = null, headers = {} } = {}) {
  return { method, query, body, headers: { authorization: 'Bearer SESS', ...headers }, socket: { remoteAddress: '127.0.0.1' } };
}
function mkRes() {
  const res = { _status: 200, _json: null, statusCode: 200 };
  res.status = (c) => { res._status = c; res.statusCode = c; return res; };
  res.setHeader = () => res; res.end = () => res;
  res.send = (s) => { try { res._json = JSON.parse(s); } catch { res._json = s; } return res; };
  return res;
}
async function call(handler, reqOpt) { const res = mkRes(); await handler(mkReq(reqOpt), res); return res; }

(async () => {
  await setup();
  const search = require(path.join(API, 'rh_search.js'));
  const unlock = require(path.join(API, 'rh_unlock.js'));
  const candidate = require(path.join(API, 'rh_candidate.js'));
  const invite = require(path.join(API, 'rh_invite.js'));
  const dispute = require(path.join(API, 'rh_dispute.js'));
  const cand = require(path.join(API, 'cand_portal.js'));
  const wallet = require(path.join(API, 'rh_wallet.js'));

  console.log('\n# Busca anônima');
  let r = await call(search, { query: { skills: 'React,Node' } });
  ok('busca responde 200', r._status === 200);
  ok('retorna 2 candidatos', r._json.total === 2);
  const top = r._json.data[0];
  ok('ordena por aderência (Ana 1º)', top.token === 'PUB_OK');
  ok('NÃO vaza PII (sem nome/email)', !('nome' in top) && !('email' in top));
  ok('expõe scores', typeof top.adherence === 'number' && typeof top.confidence === 'number');
  ok('generaliza região', top.regiao && top.regiao !== 'São Paulo');

  console.log('\n# Perfil anônimo detalhado');
  r = await call(candidate, { query: { token: 'PUB_OK', skills: 'React,Node' } });
  ok('perfil 200 com breakdown', r._status === 200 && Array.isArray(r._json.adherence_reasons));
  ok('ainda sem reveal antes do desbloqueio', !r._json.unlocked && !r._json.revealed);

  console.log('\n# Desbloqueio do candidato BOM');
  r = await call(unlock, { method: 'POST', body: { token: 'PUB_OK', criteria: { skills: ['React'] } } });
  ok('desbloqueio 200', r._status === 200);
  ok('unlocked=true', r._json.unlocked === true);
  ok('saldo caiu para 4', r._json.balance === 4);
  ok('revela PII (nome/email/telefone)', r._json.candidate && r._json.candidate.nome === 'Ana Silva' && !!r._json.candidate.email);

  console.log('\n# Desbloqueio duplicado é bloqueado');
  r = await call(unlock, { method: 'POST', body: { token: 'PUB_OK' } });
  ok('bloqueia duplicado (409)', r._status === 409);

  console.log('\n# Antifrustração: contato inválido → estorno automático');
  r = await call(unlock, { method: 'POST', body: { token: 'PUB_BAD' } });
  ok('refunded=true', r._json.refunded === true);
  ok('saldo volta a 4 (debita e estorna)', r._json.balance === 4);
  const vis = await pool.query("SELECT visibility FROM candidates WHERE public_token='PUB_BAD'");
  ok('perfil de contato inválido vira hidden', vis.rows[0].visibility === 'hidden');

  console.log('\n# Convite inicia SLA de 7 dias');
  r = await call(invite, { method: 'POST', body: { token: 'PUB_OK' } });
  ok('convite 200 com SLA', r._status === 200 && !!r._json.sla_deadline);
  const u = await pool.query("SELECT invited_at, sla_deadline, status FROM unlocks WHERE candidate_id=1");
  ok('unlock marcado invited + sla', !!u.rows[0].invited_at && !!u.rows[0].sla_deadline);

  console.log('\n# Candidato responde (satisfaz SLA)');
  r = await call(cand, { method: 'POST', query: { action: 'respond' }, body: { token: 'CAND_OK' }, headers: {} });
  ok('respond 200', r._status === 200 && r._json.respondidos === 1);
  const u2 = await pool.query("SELECT status, responded_at FROM unlocks WHERE candidate_id=1");
  ok('unlock vira responded', u2.rows[0].status === 'responded');

  console.log('\n# Candidato: reconfirmar e revogar consentimento');
  r = await call(cand, { method: 'POST', query: { action: 'reconfirm' }, body: { token: 'CAND_OK' }, headers: {} });
  ok('reconfirma interesse', r._status === 200 && r._json.profile.active === true);
  r = await call(cand, { method: 'POST', query: { action: 'consent' }, body: { token: 'CAND_OK', value: false }, headers: {} });
  ok('revoga consentimento', r._json.b2b_consent === false);
  const after = await pool.query("SELECT b2b_consent, visibility FROM candidates WHERE confirm_token='CAND_OK'");
  ok('revogação tira da base (hidden)', after.rows[0].visibility === 'hidden' && after.rows[0].b2b_consent === false);

  console.log('\n# Carteira reflete o extrato');
  r = await call(wallet, { method: 'GET' });
  ok('wallet 200', r._status === 200);
  ok('saldo final = 4', r._json.balance === 4);
  ok('extrato tem lançamentos', r._json.ledger.length >= 3);

  console.log('\n# Auditoria registrou reveal_pii');
  const logs = await pool.query("SELECT COUNT(*)::int n FROM access_logs WHERE action='reveal_pii'");
  ok('log de reveal_pii existe', logs.rows[0].n >= 1);

  console.log(`\n──────── ${pass} passaram · ${fail} falharam ────────`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO NO TESTE:', e); process.exit(1); });
