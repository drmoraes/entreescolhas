// Integração: convite por e-mail (Nodemailer mockado) + gancho de WhatsApp + SLA.
// Rode: NODE_PATH=<outputs>/node_modules node tests/invite_email.test.js
const path = require('path');
const { newDb } = require('pg-mem');

const API = path.join(__dirname, '..', 'api');
let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗ FAIL:', n); } }

const db = newDb();
db.public.registerFunction({ name: 'now', returns: 'timestamptz', implementation: () => new Date() });
const pg = db.adapters.createPg();
const pool = new pg.Pool();
const dbPath = require.resolve(path.join(API, '_lib', 'db.js'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  getDB: () => pool, query: (t, p = []) => pool.query(t, p) } };

// mock do mailer
let SENT = [];
const mailPath = require.resolve(path.join(API, '_lib', 'mailer.js'));
require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: {
  send: async (to, subject, html) => { SENT.push({ to, subject, html }); return true; },
  getLastError: () => '' } };

async function setup() {
  await pool.query(`CREATE TABLE companies(id serial primary key, nome text, email text, plan text default 'growth',
    status text default 'ativa', reputation int default 100, created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE company_users(id serial primary key, company_id int, nome text, email text,
    password_hash text, role text, session_token text, session_expires timestamptz, last_login timestamptz,
    created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE candidates(id serial primary key, nome text, email text, telefone text,
    public_token text, confirm_token text, invites_total int default 0)`);
  await pool.query(`CREATE TABLE unlocks(id serial primary key, company_id int, candidate_id int, status text default 'active',
    invited_at timestamptz, sla_deadline timestamptz, credits_spent int default 1, created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE access_logs(id serial primary key, company_id int, company_user_id int, candidate_id int,
    action text, purpose text, ip text, meta jsonb, created_at timestamptz default now())`);
  await pool.query(`INSERT INTO companies(nome,email) VALUES('Demo','demo@x.com')`);
  await pool.query(`INSERT INTO company_users(company_id,nome,email,role,session_token,session_expires)
    VALUES(1,'R','demo@x.com','owner','SESS',now()+ interval '7 days')`);
  await pool.query(`INSERT INTO candidates(nome,email,telefone,public_token,confirm_token)
    VALUES('Ana Silva','ana@mail.com','11999998888','PUB_OK','CAND_OK')`);
  await pool.query(`INSERT INTO unlocks(company_id,candidate_id,status) VALUES(1,1,'active')`);
}
function mkReq(o = {}) { return { method: o.method || 'POST', query: o.query || {}, body: o.body || null,
  headers: { authorization: 'Bearer SESS', ...(o.headers || {}) }, socket: { remoteAddress: '127.0.0.1' } }; }
function mkRes() { const r = { _status: 200 }; r.status = c => { r._status = c; r.statusCode = c; return r; };
  r.setHeader = () => r; r.end = () => r; r.send = s => { try { r._json = JSON.parse(s); } catch { r._json = s; } return r; }; return r; }
async function call(h, o) { const res = mkRes(); await h(mkReq(o), res); return res; }

(async () => {
  process.env.APP_BASE_URL = 'https://site.com';
  await setup();
  const invite = require(path.join(API, 'rh_invite.js'));

  console.log('\n# Convite dispara e-mail + SLA + WhatsApp');
  let r = await call(invite, { body: { token: 'PUB_OK', message: 'Vi seu perfil, vamos conversar?' } });
  ok('responde 200', r._status === 200);
  ok('email_sent=true', r._json.email_sent === true);
  ok('enviou 1 e-mail', SENT.length === 1);
  ok('e-mail foi para o candidato', SENT[0].to === 'ana@mail.com');
  ok('assunto correto', /quer falar com você/i.test(SENT[0].subject));
  ok('html tem link do portal com token privado', SENT[0].html.includes('meu-perfil.html?token=CAND_OK'));
  ok('html traz a mensagem do RH', SENT[0].html.includes('vamos conversar'));
  ok('whatsapp_url com DDI 55', /wa\.me\/5511999998888/.test(r._json.whatsapp_url));
  ok('SLA definido', !!r._json.sla_deadline);
  const u = await pool.query('SELECT invited_at, sla_deadline FROM unlocks WHERE id=1');
  ok('unlock marcado como convidado', !!u.rows[0].invited_at && !!u.rows[0].sla_deadline);

  console.log('\n# Não permite convite duplicado');
  r = await call(invite, { body: { token: 'PUB_OK' } });
  ok('bloqueia duplicado (409)', r._status === 409);
  ok('não envia outro e-mail', SENT.length === 1);

  console.log(`\n──────── ${pass} passaram · ${fail} falharam ────────`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO:', e); process.exit(1); });
