// POST /api/b2b?fn=vaga_apply — captura o LEAD da candidatura e:
//  • vaga direta  → registra candidatura interna (alimenta o Banco de Talentos)
//  • vaga externa → captura o lead e devolve o link de origem para redirecionar
// Em ambos, cadastra/atualiza o candidato (gera lead).
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
  const consent = b.consent !== false; // quer entrar no Banco de Talentos (default sim)
  if (!vagaId) return err(res, 'vaga_id obrigatório');
  if (nome.length < 2) return err(res, 'Nome obrigatório');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');

  const v = await query('SELECT id, url, titulo FROM vagas WHERE id = $1 AND status = $2', [vagaId, 'ativa']);
  const vaga = v.rows[0];
  if (!vaga) return err(res, 'Vaga indisponível', 404);

  // ── cadastra/atualiza o candidato (LEAD) ──
  let candidateId = null;
  try {
    const ex = await query('SELECT id FROM candidates WHERE email = $1', [email]);
    if (ex.rows[0]) {
      candidateId = ex.rows[0].id;
      await query(
        `UPDATE candidates SET nome = COALESCE(NULLIF($1,''), nome),
                telefone = COALESCE($2, telefone),
                b2b_consent = CASE WHEN $3 THEN TRUE ELSE b2b_consent END,
                b2b_consent_at = CASE WHEN $3 AND b2b_consent_at IS NULL THEN NOW() ELSE b2b_consent_at END,
                last_confirmed_at = NOW(), updated_at = NOW()
           WHERE id = $4`, [nome, telefone, consent, candidateId]);
    } else {
      const ins = await query(
        `INSERT INTO candidates (nome, email, telefone, source, b2b_consent, b2b_consent_at, last_confirmed_at, public_token)
         VALUES ($1,$2,$3,'vaga',$4, CASE WHEN $4 THEN NOW() ELSE NULL END, NOW(), encode(gen_random_bytes(16),'hex'))
         RETURNING id`, [nome, email, telefone, consent]);
      candidateId = ins.rows[0].id;
    }
  } catch (e) { /* não bloqueia a candidatura por erro de cadastro */ }

  // ── registra a candidatura (sem duplicar o mesmo e-mail na mesma vaga) ──
  try {
    const dup = await query('SELECT id FROM vaga_applications WHERE vaga_id = $1 AND LOWER(email) = $2', [vagaId, email]);
    if (!dup.rows[0]) {
      await query('INSERT INTO vaga_applications (vaga_id, candidate_id, nome, email, telefone) VALUES ($1,$2,$3,$4,$5)',
        [vagaId, candidateId, nome, email, telefone]);
    }
  } catch (e) { /* não bloqueia */ }

  // externa → manda pra origem depois de capturar o lead
  if (vaga.url) return json(res, { ok: true, redirect: vaga.url });
  return json(res, { ok: true });
};
