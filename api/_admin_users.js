// /api/b2b?fn=admin_users&op=list|save|toggle|rotate|audit — usuários admin & papéis.
// Só 'owner' (ou a chave mestra) gerencia usuários. Tokens individuais por usuário.
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { genToken } = require('./_lib/tokens');

const ROLES = ['owner', 'financeiro', 'suporte', 'leitura'];
function maskToken(t) { return t ? t.slice(0, 6) + '••••' + t.slice(-4) : ''; }

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const actor = req.actor || {};
  const isOwner = actor.master || actor.role === 'owner';
  const op = String((req.query && req.query.op) || 'list');

  // ── AUDITORIA (qualquer admin autenticado pode ver) ──────
  if (op === 'audit') {
    const { rows } = await query(
      'SELECT actor_nome, action, detail, created_at FROM admin_audit ORDER BY created_at DESC LIMIT 80');
    return json(res, { ok: true, data: rows });
  }

  // ── LISTAR ───────────────────────────────────────────────
  if (op === 'list') {
    if (!isOwner) return err(res, 'Apenas o owner gerencia usuários', 403);
    const { rows } = await query(
      'SELECT id, nome, email, role, status, token, created_at, last_seen_at FROM admin_users ORDER BY created_at');
    return json(res, { ok: true, me: { nome: actor.nome, role: actor.role || 'owner', master: !!actor.master },
      data: rows.map((u) => ({ ...u, token_mask: maskToken(u.token), token: undefined })) });
  }

  // daqui pra baixo, só owner/master
  if (!isOwner) return err(res, 'Apenas o owner gerencia usuários', 403);

  // ── SALVAR (criar/editar) ────────────────────────────────
  if (op === 'save') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const b = getJsonBody(req) || {};
    const id = Number(b.id) || null;
    const nome = String(b.nome || '').trim();
    const email = String(b.email || '').toLowerCase().trim();
    const role = ROLES.includes(b.role) ? b.role : 'leitura';
    if (nome.length < 2) return err(res, 'Nome obrigatório');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');

    try {
      if (id) {
        const { rows } = await query(
          'UPDATE admin_users SET nome=$1, email=$2, role=$3 WHERE id=$4 RETURNING id',
          [nome, email, role, id]);
        if (!rows[0]) return err(res, 'Usuário não encontrado', 404);
        await logAdmin(req, 'user_edit', `${nome} (${role})`);
        return json(res, { ok: true, id, updated: true });
      }
      const token = genToken();
      const { rows } = await query(
        'INSERT INTO admin_users (nome, email, role, token) VALUES ($1,$2,$3,$4) RETURNING id',
        [nome, email, role, token]);
      await logAdmin(req, 'user_create', `${nome} (${role})`);
      // devolve o token UMA vez (em claro) para o owner compartilhar
      return json(res, { ok: true, id: rows[0].id, created: true, token });
    } catch (e) {
      if (/unique|duplicate/i.test(e.message)) return err(res, 'Já existe um usuário com esse e-mail', 409);
      throw e;
    }
  }

  // ── ATIVAR/DESATIVAR ─────────────────────────────────────
  if (op === 'toggle') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const id = Number((getJsonBody(req) || {}).id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query(
      "UPDATE admin_users SET status = CASE WHEN status='ativo' THEN 'inativo' ELSE 'ativo' END WHERE id=$1 RETURNING id, status, nome", [id]);
    if (!rows[0]) return err(res, 'Usuário não encontrado', 404);
    await logAdmin(req, 'user_toggle', `${rows[0].nome} → ${rows[0].status}`);
    return json(res, { ok: true, id, status: rows[0].status });
  }

  // ── GIRAR TOKEN (revoga o antigo, gera novo) ─────────────
  if (op === 'rotate') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const id = Number((getJsonBody(req) || {}).id);
    if (!id) return err(res, 'id obrigatório');
    const token = genToken();
    const { rows } = await query('UPDATE admin_users SET token=$1 WHERE id=$2 RETURNING id, nome', [token, id]);
    if (!rows[0]) return err(res, 'Usuário não encontrado', 404);
    await logAdmin(req, 'user_rotate_token', rows[0].nome);
    return json(res, { ok: true, id, token });
  }

  return err(res, 'op inválida (use list|save|toggle|rotate|audit)');
};
