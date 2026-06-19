// Integração: compra de créditos via Mercado Pago (preference + webhook idempotente).
// Mocka a API do MP via global.fetch e usa Postgres em memória (pg-mem).
// Rode: NODE_PATH=<outputs>/node_modules node tests/mp_credits.test.js
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

const { hashPassword } = require(path.join(API, '_lib', 'b2b-auth'));

// ── MP mock ──────────────────────────────────────────────────
let CAPTURED_EXTREF = null;
global.fetch = async (url, opts) => {
  if (String(url).includes('/checkout/preferences')) {
    const body = JSON.parse(opts.body);
    CAPTURED_EXTREF = body.external_reference; // guarda p/ o webhook
    return { ok: true, json: async () => ({ id: 'PREF1', init_point: 'https://mp/checkout/PREF1' }) };
  }
  if (String(url).includes('/v1/payments/')) {
    return { ok: true, json: async () => ({ status: 'approved', external_reference: CAPTURED_EXTREF }) };
  }
  throw new Error('URL inesperada: ' + url);
};

async function setup() {
  await pool.query(`CREATE TABLE companies(id serial primary key, nome text, email text, plan text default 'growth',
    status text default 'ativa', reputation int default 100, created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE company_users(id serial primary key, company_id int, nome text, email text,
    password_hash text, role text, session_token text, session_expires timestamptz, last_login timestamptz,
    created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE credit_ledger(id serial primary key, company_id int, delta int, reason text,
    ref_type text, ref_id int, balance_after int, meta jsonb, created_at timestamptz default now(), expires_at timestamptz)`);
  await pool.query(`CREATE TABLE credit_orders(id serial primary key, company_id int, package text, credits int, price numeric,
    external_reference text unique, status text default 'pending', mp_preference_id text, mp_payment_id text,
    created_at timestamptz default now(), paid_at timestamptz)`);
  await pool.query(`CREATE TABLE access_logs(id serial primary key, company_id int, company_user_id int, candidate_id int,
    action text, purpose text, ip text, meta jsonb, created_at timestamptz default now())`);
  await pool.query(`CREATE TABLE rate_limit_hits(id serial primary key, ip text, route text, created_at timestamptz default now())`);
  await pool.query(`INSERT INTO companies(nome,email) VALUES('Demo','demo@x.com')`);
  await pool.query(`INSERT INTO company_users(company_id,nome,email,password_hash,role,session_token,session_expires)
    VALUES(1,'R','demo@x.com',$1,'owner','SESS',now()+ interval '7 days')`, [hashPassword('x')]);
  await pool.query(`INSERT INTO credit_ledger(company_id,delta,reason,balance_after) VALUES(1,2,'bonus',2)`);
}
function mkReq(o = {}) { return { method: o.method || 'GET', query: o.query || {}, body: o.body || null,
  headers: { authorization: 'Bearer SESS', ...(o.headers || {}) }, socket: { remoteAddress: '127.0.0.1' } }; }
function mkRes() { const r = { _status: 200 }; r.status = c => { r._status = c; r.statusCode = c; return r; };
  r.setHeader = () => r; r.end = () => r; r.send = s => { try { r._json = JSON.parse(s); } catch { r._json = s; } return r; }; return r; }
async function call(h, o) { const res = mkRes(); await h(mkReq(o), res); return res; }

(async () => {
  process.env.MP_ACCESS_TOKEN = 'TEST-TOKEN';
  process.env.APP_BASE_URL = 'https://site.com';
  await setup();
  const wallet = require(path.join(API, 'rh_wallet.js'));
  const webhook = require(path.join(API, 'mp_webhook_credits.js'));

  console.log('\n# Compra cria preference (não credita ainda)');
  let r = await call(wallet, { method: 'POST', body: { package: 'p10' } });
  ok('retorna init_point', r._json && r._json.init_point === 'https://mp/checkout/PREF1');
  ok('pedido fica pending', (await pool.query("SELECT status FROM credit_orders")).rows[0].status === 'pending');
  ok('saldo ainda 2 (sem crédito antes de pagar)', (await pool.query("SELECT COALESCE(SUM(delta),0)::int s FROM credit_ledger WHERE company_id=1")).rows[0].s === 2);

  console.log('\n# Webhook aprovado credita a empresa');
  await call(webhook, { method: 'POST', query: { type: 'payment', 'data.id': 'PAY1' } });
  let bal = (await pool.query("SELECT COALESCE(SUM(delta),0)::int s FROM credit_ledger WHERE company_id=1")).rows[0].s;
  ok('saldo vira 12 (2 + 10)', bal === 12);
  ok('pedido vira paid', (await pool.query("SELECT status FROM credit_orders")).rows[0].status === 'paid');

  console.log('\n# Idempotência: reenvio do webhook não credita de novo');
  await call(webhook, { method: 'POST', query: { type: 'payment', 'data.id': 'PAY1' } });
  bal = (await pool.query("SELECT COALESCE(SUM(delta),0)::int s FROM credit_ledger WHERE company_id=1")).rows[0].s;
  ok('saldo continua 12 (não duplica)', bal === 12);

  console.log('\n# Webhook ignora external_reference que não é de crédito');
  CAPTURED_EXTREF = 'lead_token_abc';
  r = await call(webhook, { method: 'POST', query: { type: 'payment', 'data.id': 'PAY2' } });
  ok('responde 200 e ignora', r._status === 200);

  console.log(`\n──────── ${pass} passaram · ${fail} falharam ────────`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO:', e); process.exit(1); });
