// POST /api/submit — recebe cadastro do banco de talentos (público).
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { checkRateLimit } = require('./_lib/rate-limit');

function sanitizePhone(p) {
  const digits = String(p).replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return p;
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req);
  if (!data) return err(res, 'Invalid JSON');

  const nome = String(data.nome ?? '').trim();
  const email = String(data.email ?? '').toLowerCase().trim();

  if (nome.length < 2) return err(res, 'Nome obrigatório');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');
  if (!data.consents?.termos) return err(res, 'Aceite dos Termos de Uso obrigatório');
  if (!data.consents?.privacidade) return err(res, 'Aceite da Política de Privacidade obrigatório');
  if (!data.consents?.lgpd) return err(res, 'Consentimento LGPD obrigatório');

  const rl = await checkRateLimit(req, 'submit', 10);
  if (!rl.ok) return err(res, 'Muitas tentativas. Tente novamente em uma hora.', 429);

  const { rows: existingRows } = await query('SELECT id, status FROM candidates WHERE email = $1', [email]);
  const existing = existingRows[0];

  const telefone = sanitizePhone(data.telefone ?? '');
  const cidade = String(data.cidade ?? '').trim();
  const linkedin = String(data.linkedin ?? '').trim();
  const objetivo = data.objetivo ?? '';
  const cargo = String(data.cargo ?? '').trim();
  const empresa = String(data.empresa ?? '').trim();
  const experiencia = data.experiencia ?? '';
  const escolaridade = data.escolaridade ?? '';
  const senioridade = data.senioridade ?? '';
  const arquetipo = data.arquetipo ?? null;
  const arquetipoScores = data.arquetipo_scores !== undefined ? JSON.stringify(data.arquetipo_scores) : null;
  const pcd = !!data.pcd;
  const pcdTipo = String(data.pcd_tipo ?? '').trim();
  const consents = JSON.stringify(data.consents ?? {});

  if (existing) {
    await query(
      `UPDATE candidates SET
          nome=$1, telefone=$2, cidade=$3, linkedin=$4,
          objetivo=$5, cargo=$6, empresa=$7, experiencia=$8,
          escolaridade=$9, senioridade=$10,
          arquetipo=$11, arquetipo_scores=$12,
          pcd=$13, pcd_tipo=$14, consents=$15,
          updated_at=NOW()
       WHERE email=$16`,
      [nome, telefone, cidade, linkedin, objetivo, cargo, empresa, experiencia,
       escolaridade, senioridade, arquetipo, arquetipoScores, pcd, pcdTipo, consents, email]
    );
    return json(res, { ok: true, id: existing.id, updated: true });
  }

  const { rows } = await query(
    `INSERT INTO candidates
        (nome, email, telefone, cidade, linkedin, objetivo,
         cargo, empresa, experiencia, escolaridade, senioridade,
         arquetipo, arquetipo_scores, pcd, pcd_tipo, consents, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    [nome, email, telefone, cidade, linkedin, objetivo, cargo, empresa, experiencia,
     escolaridade, senioridade, arquetipo, arquetipoScores, pcd, pcdTipo, consents,
     'banco-de-talentos']
  );

  json(res, { ok: true, id: rows[0].id, updated: false });
};
