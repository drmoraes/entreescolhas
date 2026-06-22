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
    const free = await getSetting('free_mode', '0');
    return json(res, { ok: true, report_price: Number(price), free_mode: free === '1' });
  }

  if (op === 'set') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    if (!adminCan((req.actor || {}).role, 'coupons')) return err(res, 'Seu perfil não pode alterar as configurações.', 403);
    const body = getJsonBody(req) || {};
    if (body.report_price !== undefined) {
      const v = Number(body.report_price);
      if (!(v > 0) || v > 999) return err(res, 'Valor inválido (use algo entre 0,01 e 999).');
      await setSetting('report_price', v.toFixed(2));
      await logAdmin(req, 'set_report_price', `R$ ${v.toFixed(2)}`);
    }
    if (body.free_mode !== undefined) {
      await setSetting('free_mode', body.free_mode ? '1' : '0');
      await logAdmin(req, 'set_free_mode', body.free_mode ? 'ON' : 'OFF');
    }
    const price = await getSetting('report_price', String(process.env.MP_REPORT_PRICE || '7.97'));
    const free = await getSetting('free_mode', '0');
    return json(res, { ok: true, report_price: Number(price), free_mode: free === '1' });
  }

  return err(res, 'op inválida (use get|set)');
};
