// POST /api/b2b?fn=vaga_apply — candidatura INTERNA (vagas diretas, sem url externa).
// Registra a candidatura e vincula ao candidato (por e-mail) — alimenta o Banco de Talentos.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);
  const b = getJsonBody(req) || {};
  const vagaId = Number(b.vaga_id);
  const nome = String(b.nome || '').trim();
  const email = String(b.email || '').toLowerCase().trim();
  const telefone = String(b.telefone || '').trim() || null;
  if (!vagaId) return err(res, 'vaga_id obrigatório');
  if (nome.length < 2) return err(res, 'Nome obrigatório');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');

  const v = await query('SELECT id, url FROM vagas WHERE id = $1 AND status = $2', [vagaId, 'ativa']);
  if (!v.rows[0]) return err(res, 'Vaga indisponível', 404);
  if (v.rows[0].url) return err(res, 'Esta vaga é candidatada no site de origem.', 400);

  // vincula ao candidato existente (se houver) — para alimentar o Banco de Talentos
  let candidateId = null;
  try {
    const c = await query('SELECT id FROM candidates WHERE email = $1', [email]);
    if (c.rows[0]) candidateId = c.rows[0].id;
  } catch (e) {}

  // evita candidatura duplicada do mesmo e-mail na mesma vaga
  const dup = await query('SELECT id FROM vaga_applications WHERE vaga_id = $1 AND LOWER(email) = $2', [vagaId, email]);
  if (dup.rows[0]) return json(res, { ok: true, already: true });

  await query(
    'INSERT INTO vaga_applications (vaga_id, candidate_id, nome, email, telefone) VALUES ($1,$2,$3,$4,$5)',
    [vagaId, candidateId, nome, email, telefone]);
  return json(res, { ok: true });
};
