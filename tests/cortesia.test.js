// Cortesias (teste 100% grátis) + visão de Clientes — integração com pg-mem.
// Exercita: cortesia pessoal por e-mail → paywall detecta → libera grátis;
// link com limite de usos; revogação; restrição por teste; importação dos
// códigos antigos (app_settings); e a lista de clientes do Admin.
// Rode: NODE_PATH=<dir>/node_modules node tests/cortesia.test.js
const path = require('path');
const { newDb } = require('pg-mem');

const API = path.join(__dirname, '..', 'api');
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗ FAIL:', name); } }

const db = newDb();
db.public.registerFunction({ name: 'now', returns: 'timestamptz', implementation: () => new Date() });
const pg = db.adapters.createPg();
const pool = new pg.Pool();

const dbPath = require.resolve(path.join(API, '_lib', 'db.js'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  getDB: () => pool, query: (text, params = []) => pool.query(text, params) } };

const sent = [];
const mailPath = require.resolve(path.join(API, '_lib', 'mailer.js'));
require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: {
  send: async (to, subject, html) => { sent.push({ to, subject, html }); return true; }, getLastError: () => '' } };

process.env.ADMIN_API_KEY = 'chave-teste';
process.env.APP_BASE_URL = 'https://www.entreescolhas.com.br';

async function setup() {
  await pool.query(`CREATE TABLE leads(id serial primary key, nome text, email text, jornada text,
    confirm_token text, confirmed_at timestamptz, access_token text unique, attempts_used int default 0,
    payment_status text default 'pending', mp_preference_id text, mp_payment_id text, report_json jsonb,
    report_sent_at timestamptz, ip text, reset_count int default 0, last_reset_at timestamptz,
    referred_by_code text, created_at timestamptz default now(), updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE app_settings(key text primary key, value text, updated_at timestamptz default now())`);
  await pool.query(`CREATE TABLE admin_audit(id serial primary key, actor_id int, actor_nome text, action text,
    detail text, ip text, created_at timestamptz default now())`);
  await pool.query(`CREATE TABLE admin_users(id serial primary key, nome text, email text, role text, token text,
    status text default 'ativo', last_seen_at timestamptz)`);
  await pool.query(`CREATE TABLE candidates(id serial primary key, nome text, email text, status text default 'novo',
    cargo text, cidade text, created_at timestamptz default now())`);
  await pool.query(`CREATE TABLE purchases(id serial primary key, email text, lead_id int, kind text default 'single',
    jornada text, amount numeric(10,2), discount_amount numeric(10,2) default 0, payment_method text,
    status text default 'pending', paid_at timestamptz, created_at timestamptz default now())`);
  await pool.query(`CREATE TABLE test_attempts(id serial primary key, lead_id int, jornada text, attempt_no int,
    report_json jsonb, arquetipo text, paid boolean default false, ip text, created_at timestamptz default now())`);
}

function call(handler, { method = 'GET', query = {}, body = null, key = 'chave-teste' } = {}) {
  return new Promise((resolve, reject) => {
    const req = { method, query, body, headers: key ? { 'x-api-key': key } : {} };
    const res = {
      _status: 200,
      status(c) { this._status = c; return this; },
      setHeader() { return this; },
      send(s) { resolve({ status: this._status, data: JSON.parse(s) }); },
      end() { resolve({ status: this._status, data: null }); },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

const REPORT = { arch: { name: 'O Arquiteto', insights: [] }, scores: { SIS: 80 }, dimNames: { SIS: 'Organização' } };
async function novoLead(nome, email, jornada, { report = true, token } = {}) {
  const t = token || ('tok-' + Math.random().toString(36).slice(2));
  await pool.query(
    `INSERT INTO leads (nome,email,jornada,confirm_token,confirmed_at,access_token,attempts_used,report_json)
     VALUES ($1,$2,$3,'c',NOW(),$4,$5,$6)`,
    [nome, email, jornada, t, report ? 1 : 0, report ? JSON.stringify(REPORT) : null]);
  return t;
}

(async () => {
  await setup();
  const adminCortesias = require(path.join(API, '_admin_cortesias'));
  const adminClientes = require(path.join(API, '_admin_clientes'));
  const adminTests = require(path.join(API, '_admin_tests'));
  const unlock = require(path.join(API, '_cortesia_unlock'));
  const leadStatus = require(path.join(API, 'lead_status'));
  const { setSetting, getSetting } = require(path.join(API, '_lib', 'settings'));

  console.log('\n# Acesso');
  let r = await call(adminCortesias, { key: 'errada' });
  ok('sem chave válida → 401', r.status === 401);

  console.log('\n# Importação dos códigos antigos');
  await setSetting('cortesia_config', JSON.stringify([{ code: 'SEGUIDORES', expires: '', max_uses: 2, uses: 1 }]));
  await setSetting('cortesia_codes', 'IMPRENSA');
  r = await call(adminCortesias, { query: { op: 'list' } });
  ok('lista abre e cria as tabelas sozinha', r.status === 200 && r.data.ok);
  ok('importou 2 códigos antigos', r.data.importados === 2 && r.data.cortesias.length === 2);
  ok('preservou o contador de usos', r.data.cortesias.find((c) => c.code === 'SEGUIDORES').uses === 1);
  ok('limpou as settings antigas', (await getSetting('cortesia_codes', '')) === '' && (await getSetting('cortesia_config', '[]')) === '[]');

  console.log('\n# Cortesia pessoal (por e-mail)');
  r = await call(adminCortesias, { method: 'POST', query: { op: 'create' }, body: { tipo: 'pessoa', email: 'nao-e-email' } });
  ok('e-mail inválido é recusado', r.status === 400);
  r = await call(adminCortesias, { method: 'POST', query: { op: 'create' },
    body: { tipo: 'pessoa', nome: 'Carla Cliente', email: 'Carla@Empresa.com', empresa: 'ACME', jornadas: ['perfil', 'fit-cultural'], motivo: 'Demonstração', send_invite: true } });
  ok('cria cortesia pessoal', r.status === 200 && r.data.cortesia.tipo === 'pessoa' && r.data.cortesia.email === 'carla@empresa.com');
  ok('gera código e 2 links (perfil + fit cultural)', /^CORT-/.test(r.data.cortesia.code) && r.data.cortesia.links.length === 2);
  ok('envia o convite por e-mail', r.data.invite_ok === true && sent.length === 1 && sent[0].to === 'carla@empresa.com' && sent[0].html.includes('jornada=fit-cultural'));
  const carla = r.data.cortesia;

  const tCarla = await novoLead('Carla Cliente', 'carla@empresa.com', 'fit-cultural');
  r = await call(leadStatus, { query: { access: tCarla }, key: null });
  ok('paywall enxerga a cortesia pelo e-mail (sem código)', r.status === 200 && r.data.cortesia === true && r.data.paid === false);

  const tOutra = await novoLead('Outra Pessoa', 'outra@x.com', 'fit-cultural');
  r = await call(leadStatus, { query: { access: tOutra }, key: null });
  ok('quem não tem cortesia vê o paywall normal', r.data.cortesia === false);
  r = await call(unlock, { method: 'POST', body: { access: tOutra, code: carla.code }, key: null });
  ok('código pessoal não funciona com outro e-mail', r.status === 403 && /outro e-mail/.test(r.data.error));

  const tCarlaScanner = await novoLead('Carla Cliente', 'carla@empresa.com', 'scanner');
  r = await call(unlock, { method: 'POST', body: { access: tCarlaScanner }, key: null });
  ok('cortesia não vale para teste fora da lista', r.status === 403);

  const antes = sent.length;
  r = await call(unlock, { method: 'POST', body: { access: tCarla }, key: null });
  ok('libera o relatório grátis', r.status === 200 && r.data.ok === true && !r.data.already);
  let l = (await pool.query('SELECT payment_status, mp_payment_id, report_sent_at FROM leads WHERE access_token=$1', [tCarla])).rows[0];
  ok('marca como pago com a origem da cortesia', l.payment_status === 'paid' && l.mp_payment_id === 'cortesia:' + carla.code);
  ok('envia o relatório por e-mail', sent.length === antes + 1 && !!l.report_sent_at);
  r = await call(unlock, { method: 'POST', body: { access: tCarla }, key: null });
  ok('segundo clique não consome outro uso', r.data.already === true);
  r = await call(adminCortesias, { query: { op: 'usos', id: carla.id } });
  ok('registra quem usou', r.data.data.length === 1 && r.data.data[0].email === 'carla@empresa.com');
  r = await call(leadStatus, { query: { access: tCarla }, key: null });
  ok('depois de liberado, status = pago', r.data.paid === true);

  console.log('\n# Link de cortesia (código, limite, revogação)');
  r = await call(adminCortesias, { method: 'POST', query: { op: 'create' }, body: { tipo: 'link', code: 'evento rh 2026', max_uses: 1 } });
  ok('cria link com código próprio (normalizado)', r.status === 200 && r.data.cortesia.code === 'EVENTORH2026');
  const link = r.data.cortesia;
  r = await call(adminCortesias, { method: 'POST', query: { op: 'create' }, body: { tipo: 'link', code: 'EVENTORH2026' } });
  ok('código duplicado é recusado', r.status === 400);

  const tA = await novoLead('A', 'a@x.com', 'perfil');
  const tB = await novoLead('B', 'b@x.com', 'perfil');
  const tSemTeste = await novoLead('C', 'c@x.com', 'perfil', { report: false });
  r = await call(leadStatus, { query: { access: tA, cortesia: 'eventorh2026' }, key: null });
  ok('paywall valida o código do link', r.data.cortesia === true);
  r = await call(unlock, { method: 'POST', body: { access: tSemTeste, code: 'EVENTORH2026' }, key: null });
  ok('só libera depois de concluir o teste', r.status === 403);
  r = await call(unlock, { method: 'POST', body: { access: tA, code: 'EVENTORH2026' }, key: null });
  ok('1º uso libera', r.status === 200 && r.data.ok);
  r = await call(unlock, { method: 'POST', body: { access: tB, code: 'EVENTORH2026' }, key: null });
  ok('2º uso bate no limite', r.status === 403 && /limite/.test(r.data.error));
  r = await call(leadStatus, { query: { access: tB, cortesia: 'EVENTORH2026' }, key: null });
  ok('código esgotado → paywall volta ao normal', r.data.cortesia === false);

  r = await call(unlock, { method: 'POST', body: { access: tB, code: 'IMPRENSA' }, key: null });
  ok('código antigo importado continua funcionando', r.status === 200 && r.data.ok);
  const tD = await novoLead('D', 'd@x.com', 'perfil');
  const imprensa = (await pool.query("SELECT id FROM cortesias WHERE code='IMPRENSA'")).rows[0];
  r = await call(adminCortesias, { method: 'POST', query: { op: 'toggle' }, body: { id: imprensa.id } });
  ok('revoga', r.data.cortesia.estado === 'revogada');
  r = await call(unlock, { method: 'POST', body: { access: tD, code: 'IMPRENSA' }, key: null });
  ok('código revogado deixa de liberar', r.status === 403);
  r = await call(unlock, { method: 'POST', body: { access: tD, code: 'NAOEXISTE' }, key: null });
  ok('código inexistente é recusado', r.status === 403);

  console.log('\n# Liberação manual (Testes) + painel');
  const leadD = (await pool.query('SELECT id FROM leads WHERE access_token=$1', [tD])).rows[0];
  r = await call(adminTests, { method: 'POST', query: { op: 'cortesia' }, body: { id: leadD.id } });
  ok('admin libera cortesia direto no teste', r.status === 200 && r.data.ok);
  r = await call(adminTests, { query: { op: 'list' } });
  ok('lista de testes mostra a origem da liberação', r.data.data.find((x) => x.id === leadD.id).liberacao === 'cortesia' && r.data.kpis.cortesias >= 3);
  r = await call(adminCortesias, { query: { op: 'list' } });
  ok('painel soma as liberações gratuitas', r.data.kpis.liberacoes === 4 && r.data.liberacoes.length === 4);
  ok('identifica a origem de cada liberação',
    r.data.liberacoes.some((x) => x.origem === 'Cortesia pessoal') && r.data.liberacoes.some((x) => x.origem === 'Liberação manual (Testes)'));
  ok('link esgotado aparece como esgotado', r.data.cortesias.find((c) => c.code === 'EVENTORH2026').estado === 'esgotada');

  console.log('\n# Clientes');
  await pool.query("INSERT INTO purchases (email, kind, amount, status) VALUES ('pagou@x.com','single',14.97,'paid')");
  const tP = await novoLead('Paula Pagante', 'pagou@x.com', 'perfil');
  await pool.query("UPDATE leads SET payment_status='paid', mp_payment_id='123456' WHERE access_token=$1", [tP]);
  await call(adminCortesias, { method: 'POST', query: { op: 'create' }, body: { tipo: 'pessoa', nome: 'Convidado Novo', email: 'novo@cliente.com', empresa: 'Beta' } });
  r = await call(adminClientes, { query: { op: 'list' } });
  ok('lista de clientes abre', r.status === 200 && r.data.ok);
  const por = (e) => r.data.data.find((p) => p.email === e);
  ok('uma linha por pessoa (Carla tem 2 testes)', por('carla@empresa.com').testes === 2);
  ok('classifica pagante com valor', por('pagou@x.com').situacao === 'pagante' && por('pagou@x.com').total_pago === 14.97);
  ok('classifica quem usou cortesia', por('carla@empresa.com').situacao === 'cortesia');
  ok('classifica quem parou no paywall', por('outra@x.com').situacao === 'nao_liberou');
  ok('mostra convidado que ainda não se cadastrou', por('novo@cliente.com').situacao === 'convidado' && por('novo@cliente.com').empresa === 'Beta');
  ok('KPIs coerentes', r.data.kpis.pagantes === 1 && r.data.kpis.receita === 14.97 && r.data.kpis.convidados === 1);
  r = await call(adminClientes, { query: { op: 'get', email: 'Carla@empresa.com' } });
  ok('ficha da pessoa traz testes e cortesias', r.status === 200 && r.data.testes.length === 2 && r.data.cortesias.length === 1
    && r.data.testes.find((t) => t.jornada === 'fit-cultural').liberacao === 'cortesia');

  console.log(`\n──────── ${pass} passaram · ${fail} falharam ────────`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
