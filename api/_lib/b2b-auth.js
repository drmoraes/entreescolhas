// ─────────────────────────────────────────────────────────────
// Autenticação das empresas (RH): hash de senha (pbkdf2, sem dependência
// externa) + sessão por token. requireCompany() protege as rotas do Portal RH.
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto');
const { query } = require('./db');
const { err } = require('./http');

const PBKDF2_ITER = 120000;
const SESSION_TTL_HOURS = 24 * 7;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, PBKDF2_ITER, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.pbkdf2Sync(String(password), salt, PBKDF2_ITER, 32, 'sha256').toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function newSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  return { token, expires };
}

// Lê o token de sessão (header Authorization: Bearer ou X-Session-Token).
function getSessionToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.headers['x-session-token'] || (req.query && req.query.session) || '';
}

// Middleware: resolve a empresa/usuário a partir da sessão. Retorna ctx ou null.
async function requireCompany(req, res) {
  const token = getSessionToken(req);
  if (!token) { err(res, 'Não autenticado', 401); return null; }

  const { rows } = await query(
    `SELECT u.id AS user_id, u.nome AS user_nome, u.email AS user_email, u.role,
            COALESCE(u.status,'ativo') AS user_status,
            u.session_expires, c.id AS company_id, c.nome AS company_nome,
            c.plan, c.status, c.reputation
       FROM company_users u
       JOIN companies c ON c.id = u.company_id
      WHERE u.session_token = $1`,
    [token]
  );
  const ctx = rows[0];
  if (!ctx) { err(res, 'Sessão inválida', 401); return null; }
  if (ctx.session_expires && new Date(ctx.session_expires) < new Date()) {
    err(res, 'Sessão expirada', 401); return null;
  }
  if (ctx.user_status && ctx.user_status !== 'ativo') { err(res, 'Usuário desativado. Fale com o administrador da conta.', 403); return null; }
  if (ctx.status !== 'ativa') { err(res, 'Conta inativa ou suspensa', 403); return null; }
  return ctx;
}

// Saldo de créditos = soma da razão.
async function getBalance(companyId) {
  const { rows } = await query(
    'SELECT COALESCE(SUM(delta),0)::int AS saldo FROM credit_ledger WHERE company_id = $1',
    [companyId]
  );
  return rows[0].saldo;
}

// Lança um movimento na razão e devolve o saldo resultante (transacional no caller).
async function postLedger(companyId, delta, reason, refType, refId, meta) {
  const saldo = await getBalance(companyId);
  const after = saldo + delta;
  await query(
    `INSERT INTO credit_ledger (company_id, delta, reason, ref_type, ref_id, balance_after, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [companyId, delta, reason, refType || null, refId || null, after, meta ? JSON.stringify(meta) : null]
  );
  return after;
}

// Registro na trilha de auditoria (append-only).
async function logAccess(ctx, candidateId, action, purpose, ip, meta) {
  await query(
    `INSERT INTO access_logs (company_id, company_user_id, candidate_id, action, purpose, ip, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [ctx?.company_id || null, ctx?.user_id || null, candidateId || null, action,
     purpose || null, ip || null, meta ? JSON.stringify(meta) : null]
  );
}

module.exports = {
  hashPassword, verifyPassword, newSession, getSessionToken,
  requireCompany, getBalance, postLedger, logAccess,
};
