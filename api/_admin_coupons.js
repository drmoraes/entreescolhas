// /api/b2b?fn=admin_coupons&op=list|save|toggle — gestão de cupons & cortesia (Admin).
// Protegido por ADMIN_API_KEY.
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { adminCan } = require('./_lib/admin-perms');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const op = String((req.query && req.query.op) || 'list');
  if (op !== 'list' && !adminCan((req.actor || {}).role, 'coupons')) return err(res, 'Seu perfil não tem permissão para gerenciar cupons.', 403);

  if (op === 'list') {
    const { rows } = await query(`
      SELECT c.*, COALESCE(SUM(r.discount),0)::numeric AS desconto_total,
             COALESCE(SUM(r.credits_granted),0)::int AS creditos_dados
        FROM coupons c LEFT JOIN coupon_redemptions r ON r.coupon_id = c.id
       GROUP BY c.id ORDER BY c.created_at DESC`);
    return json(res, { ok: true, data: rows.map(c => ({
      ...c, valor: Number(c.valor), desconto_total: Number(c.desconto_total),
    })) });
  }

  if (op === 'save') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const b = getJsonBody(req) || {};
    const id = Number(b.id) || null;
    const code = String(b.code || '').trim().toUpperCase();
    const tipo = String(b.tipo || '');
    const valor = Number(b.valor);
    if (!code || !/^[A-Z0-9_-]{3,40}$/.test(code)) return err(res, 'Código inválido (3–40, A–Z 0–9 _ -)');
    if (!['percent', 'credits'].includes(tipo)) return err(res, 'Tipo inválido');
    if (!(valor > 0)) return err(res, 'Valor deve ser > 0');
    if (tipo === 'percent' && valor > 100) return err(res, 'Percentual máximo é 100');
    const maxUses = b.max_uses === '' || b.max_uses == null ? null : parseInt(b.max_uses, 10);
    const validUntil = b.valid_until ? new Date(b.valid_until).toISOString() : null;
    const status = ['ativo', 'inativo', 'rascunho'].includes(b.status) ? b.status : 'ativo';
    const desc = String(b.description || '').slice(0, 160) || null;

    try {
      if (id) {
        const { rows } = await query(
          `UPDATE coupons SET code=$1, tipo=$2, valor=$3, max_uses=$4, valid_until=$5, status=$6, description=$7
             WHERE id=$8 RETURNING id`,
          [code, tipo, valor, maxUses, validUntil, status, desc, id]);
        if (!rows[0]) return err(res, 'Cupom não encontrado', 404);
        await logAdmin(req, 'coupon_edit', `${code} (${tipo} ${valor})`);
        return json(res, { ok: true, id, updated: true });
      }
      const { rows } = await query(
        `INSERT INTO coupons (code, tipo, valor, max_uses, valid_until, status, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [code, tipo, valor, maxUses, validUntil, status, desc]);
      await logAdmin(req, 'coupon_create', `${code} (${tipo} ${valor})`);
      return json(res, { ok: true, id: rows[0].id, created: true });
    } catch (e) {
      if (/unique|duplicate/i.test(e.message)) return err(res, 'Já existe um cupom com esse código', 409);
      throw e;
    }
  }

  if (op === 'toggle') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const b = getJsonBody(req) || {};
    const id = Number(b.id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query(
      `UPDATE coupons SET status = CASE WHEN status='ativo' THEN 'inativo' ELSE 'ativo' END
         WHERE id = $1 RETURNING id, status`, [id]);
    if (!rows[0]) return err(res, 'Cupom não encontrado', 404);
    await logAdmin(req, 'coupon_toggle', `#${id} → ${rows[0].status}`);
    return json(res, { ok: true, id, status: rows[0].status });
  }

  return err(res, 'op inválida (use list|save|toggle)');
};
