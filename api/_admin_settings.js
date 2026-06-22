// /api/b2b?fn=admin_settings&op=get|set — configurações editáveis no admin.
// Hoje: preço do relatório do candidato (B2C). Set requer perfil financeiro/owner.
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { getSetting, setSetting } = require('./_lib/settings');
const { adminCan } = require('./_lib/admin-perms');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const op = String((req.query && req.query.op) || 'get');

  if (op === 'get') {
    const price = await getSetting('report_price', String(process.env.MP_REPORT_PRICE || '7.97'));
    return json(res, { ok: true, report_price: Number(price) });
  }

  if (op === 'set') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    if (!adminCan((req.actor || {}).role, 'coupons')) return err(res, 'Seu perfil não pode alterar o preço.', 403);
    const v = Number((getJsonBody(req) || {}).report_price);
    if (!(v > 0) || v > 999) return err(res, 'Valor inválido (use algo entre 0,01 e 999).');
    await setSetting('report_price', v.toFixed(2));
    await logAdmin(req, 'set_report_price', `R$ ${v.toFixed(2)}`);
    return json(res, { ok: true, report_price: v });
  }

  return err(res, 'op inválida (use get|set)');
};
