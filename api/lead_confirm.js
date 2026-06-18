// GET /api/lead_confirm?token=... — confirma o e-mail (ou apenas valida o
// link de acesso, se já confirmado antes) e redireciona para o teste.
const { query } = require('./_lib/db');
const { genToken } = require('./_lib/tokens');

module.exports = async (req, res) => {
  const token = String(req.query.token ?? '').trim();
  const base = process.env.APP_BASE_URL;

  if (!token) {
    res.writeHead(302, { Location: `${base}/confirmar-email.html?erro=invalido` });
    return res.end();
  }

  const { rows } = await query(
    'SELECT id, jornada, access_token, confirmed_at FROM leads WHERE confirm_token = $1',
    [token]
  );
  const lead = rows[0];

  if (!lead) {
    res.writeHead(302, { Location: `${base}/confirmar-email.html?erro=invalido` });
    return res.end();
  }

  if (!lead.confirmed_at) {
    await query('UPDATE leads SET confirmed_at = NOW() WHERE id = $1', [lead.id]);
  }

  // Rotaciona o confirm_token para que o link do e-mail não funcione de novo
  await query('UPDATE leads SET confirm_token = $1 WHERE id = $2', [genToken(), lead.id]);

  const dest = `${base}/teste.html?jornada=${encodeURIComponent(lead.jornada)}&access=${encodeURIComponent(lead.access_token)}`;
  res.writeHead(302, { Location: dest });
  res.end();
};
