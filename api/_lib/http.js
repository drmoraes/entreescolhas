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

function requireApiKey(req, res) {
  const key = req.headers['x-api-key'] || (req.query && req.query.key) || '';
  if (key !== process.env.ADMIN_API_KEY) {
    err(res, 'Unauthorized', 401);
    return false;
  }
  return true;
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

module.exports = { ALLOWED_ORIGINS, setCors, json, err, requireApiKey, getJsonBody };
