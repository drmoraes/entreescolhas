// /api/b2b?fn=admin_company_users&op=list|create|update|toggle|reset_password
// Admin (owner/chave mestra) gerencia os usuários (RH) de uma empresa-cliente.
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { hashPassword } = require('./_lib/b2b-auth');
const { ROLE_LABEL } = require('./_lib/perms');

const ROLES = ['owner', 'gestor', 'analista', 'recruiter', 'leitura'];
function tempPass() {
  // senha temporária legível: 3 letras + 4 dígitos (ex.: KZP4827)
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789';
  let s = ''; for (let i = 0; i < 3; i++) s += L[Math.floor(Math.random() * L.length)];
  for (let i = 0; i < 4; i++) s += D[Math.floor(Math.random() * D.length)];
  return s;
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const actor = req.actor || {};
  if (!(actor.master || actor.role === 'owner')) return err(res, 'Apenas o owner gerencia usuários de empresa', 403);
  const op = String((req.query && req.query.op) || 'list');

  if (op === 'list') {
    const companyId = Number(req.query && req.query.company_id);
    if (!companyId) return err(res, 'company_id obrigatório');
    const { rows } = await query(
      `SELECT id, nome, email, role, COALESCE(status,'ativo') AS status, last_login, created_at
         FROM company_users WHERE company_id = $1 ORDER BY created_at`, [companyId]);
    return json(res, { ok: true, roles: ROLE_LABEL, data: rows });
  }

  if (op === 'create') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const b = getJsonBody(req) || {};
    const companyId = Number(b.company_id);
    const nome = String(b.nome || '').trim();
    const email = String(b.email || '').toLowerCase().trim();
    const role = ROLES.includes(b.role) ? b.role : 'analista';
    if (!companyId) return err(res, 'company_id obrigatório');
    if (nome.length < 2) return err(res, 'Nome obrigatório');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');
    const comp = await query('SELECT id FROM companies WHERE id = $1', [companyId]);
    if (!comp.rows[0]) return err(res, 'Empresa não encontrada', 404);

    const senha = tempPass();
    try {
      const { rows } = await query(
        `INSERT INTO company_users (company_id, nome, email, password_hash, role, status)
         VALUES ($1,$2,$3,$4,$5,'ativo') RETURNING id`,
        [companyId, nome, email, hashPassword(senha), role]);
      await logAdmin(req, 'company_user_create', `${nome} <${email}> (${role}) na empresa #${companyId}`);
      // devolve a senha temporária UMA vez para o admin repassar
      return json(res, { ok: true, id: rows[0].id, temp_password: senha });
    } catch (e) {
      if (/unique|duplicate/i.test(e.message)) return err(res, 'Já existe um usuário com esse e-mail', 409);
      throw e;
    }
  }

  if (op === 'update') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const b = getJsonBody(req) || {};
    const id = Number(b.id);
    const role = ROLES.includes(b.role) ? b.role : null;
    if (!id || !role) return err(res, 'id e role obrigatórios');
    const { rows } = await query('UPDATE company_users SET role=$1, updated_at=NOW() WHERE id=$2 RETURNING id, nome', [role, id]);
    if (!rows[0]) return err(res, 'Usuário não encontrado', 404);
    await logAdmin(req, 'company_user_update', `${rows[0].nome} → ${role}`);
    return json(res, { ok: true, id, role });
  }

  if (op === 'toggle') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const id = Number((getJsonBody(req) || {}).id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query(
      `UPDATE company_users SET status = CASE WHEN COALESCE(status,'ativo')='ativo' THEN 'inativo' ELSE 'ativo' END,
              session_token = NULL, updated_at = NOW() WHERE id=$1 RETURNING id, status, nome`, [id]);
    if (!rows[0]) return err(res, 'Usuário não encontrado', 404);
    await logAdmin(req, 'company_user_toggle', `${rows[0].nome} → ${rows[0].status}`);
    return json(res, { ok: true, id, status: rows[0].status });
  }

  if (op === 'reset_password') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const id = Number((getJsonBody(req) || {}).id);
    if (!id) return err(res, 'id obrigatório');
    const senha = tempPass();
    const { rows } = await query(
      'UPDATE company_users SET password_hash=$1, session_token=NULL, updated_at=NOW() WHERE id=$2 RETURNING id, nome',
      [hashPassword(senha), id]);
    if (!rows[0]) return err(res, 'Usuário não encontrado', 404);
    await logAdmin(req, 'company_user_reset_pw', rows[0].nome);
    return json(res, { ok: true, id, temp_password: senha });
  }

  return err(res, 'op inválida (use list|create|update|toggle|reset_password)');
};
