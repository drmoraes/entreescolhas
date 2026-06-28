// Helpers HTTP equivalentes ao antigo config.php (json/err/setCors/requireApiKey)

const ALLOWED_ORIGINS = [
  'https://www.entreescolhas.com.br',
  'https://entreescolhas.com.br',
  'https://entreescolhas.vercel.app',
  'http://localhost',
  'http://127.0.0.1',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // sinaliza que a requisição já foi finalizada
  }
  return false;
}

function json(res, data, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(data, null, 2));
}

function err(res, msg, status = 400) {
  json(res, { error: msg }, status);
}

// Aceita a CHAVE MESTRA (ADMIN_API_KEY) ou o TOKEN de um usuário admin ativo.
// Define req.actor para atribuição/auditoria. Async (faz lookup no banco para tokens).
async function requireApiKey(req, res) {
  // A chave mestra (ADMIN_API_KEY) só é aceita via header — nunca via query string,
  // para não ficar gravada em logs de acesso, histórico do navegador ou Referer.
  // Tokens de admin individuais (não a chave mestra) continuam podendo vir por query (?key=),
  // pois são revogáveis e escopados a um único usuário.
  const headerKey = req.headers['x-api-key'] || '';
  if (headerKey && headerKey === process.env.ADMIN_API_KEY) {
    req.actor = { id: null, nome: 'Chave mestra', role: 'owner', master: true };
    return true;
  }
  const key = headerKey || (req.query && req.query.key) || '';
  if (key) {
    try {
      const { query } = require('./db');
      const { rows } = await query('SELECT id, nome, role, status FROM admin_users WHERE token = $1', [key]);
      const u = rows[0];
      if (u && u.status === 'ativo') {
        req.actor = { id: u.id, nome: u.nome, role: u.role };
        query('UPDATE admin_users SET last_seen_at = NOW() WHERE id = $1', [u.id]).catch(() => {});
        return true;
      }
    } catch (e) { /* tabela pode não existir antes da migração — só a chave mestra funciona */ }
  }
  err(res, 'Unauthorized', 401);
  return false;
}

// Registra uma ação de admin com o ator (req.actor). Best-effort.
async function logAdmin(req, action, detail) {
  try {
    const { query } = require('./db');
    const a = req.actor || {};
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    await query(
      'INSERT INTO admin_audit (actor_id, actor_nome, action, detail, ip) VALUES ($1,$2,$3,$4,$5)',
      [a.id || null, a.nome || '?', action, String(detail || '').slice(0, 240), ip]);
  } catch (e) { /* não bloqueia */ }
}

// Lê e faz parse do corpo JSON (Vercel já faz isso para Content-Type: application/json,
// mas em alguns runtimes req.body pode vir como string)
function getJsonBody(req) {
  if (!req.body) return null;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return req.body;
}

module.exports = { ALLOWED_ORIGINS, setCors, json, err, requireApiKey, logAdmin, getJsonBody };
