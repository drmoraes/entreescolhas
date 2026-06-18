// Rate limiting por IP usando a tabela rate_limit_hits (10 req/hora por rota+IP).
const { query } = require('./db');

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || '0.0.0.0';
}

async function checkRateLimit(req, route, max = 10) {
  const ip = getClientIp(req);
  const { rows } = await query(
    `SELECT COUNT(*)::int AS cnt FROM rate_limit_hits
     WHERE ip = $1 AND route = $2 AND created_at >= NOW() - INTERVAL '1 hour'`,
    [ip, route]
  );
  const count = rows[0]?.cnt || 0;
  if (count >= max) return { ok: false, ip };

  await query('INSERT INTO rate_limit_hits (ip, route) VALUES ($1, $2)', [ip, route]);
  return { ok: true, ip };
}

module.exports = { checkRateLimit, getClientIp };
