// /api/b2b?fn=admin_settings&op=get|set — configurações editáveis no admin.
// Hoje: preço do relatório do candidato (B2C). Set requer perfil financeiro/owner.
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { getSetting, setSetting } = require('./_lib/settings');
const { adminCan } = require('./_lib/admin-perms');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const op = String((req.query && req.query.op) || 'get');

  async function snapshot() {
    const single = await getSetting('price_single', await getSetting('report_price', String(process.env.MP_REPORT_PRICE || '9.90')));
    const combo = await getSetting('price_combo', '19.90');
    const free = await getSetting('free_mode', '0');
    return {
      ok: true,
      report_price: Number(single),     // compat
      price_single: Number(single),
      price_combo: Number(combo),
      free_mode: free === '1',
      // custos de crédito (B2B) por categoria de candidato
      credit_cost: {
        operacional: Number(await getSetting('credit_cost_operacional', '1')),
        analista: Number(await getSetting('credit_cost_analista', '4')),
        especialista: Number(await getSetting('credit_cost_especialista', '4')),
        gerencial: Number(await getSetting('credit_cost_gerencial', '6')),
        pcd: Number(await getSetting('credit_cost_pcd', '8')),
      },
    };
  }

  const CC_KEYS = { operacional: 'credit_cost_operacional', analista: 'credit_cost_analista', especialista: 'credit_cost_especialista', gerencial: 'credit_cost_gerencial', pcd: 'credit_cost_pcd' };

  if (op === 'get') return json(res, await snapshot());

  if (op === 'set') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    if (!adminCan((req.actor || {}).role, 'coupons')) return err(res, 'Seu perfil não pode alterar as configurações.', 403);
    const body = getJsonBody(req) || {};

    // price_single (aceita também o legado report_price)
    const singleIn = body.price_single !== undefined ? body.price_single : body.report_price;
    if (singleIn !== undefined) {
      const v = Number(singleIn);
      if (!(v > 0) || v > 999) return err(res, 'Preço avulso inválido (0,01 a 999).');
      await setSetting('price_single', v.toFixed(2));
      await setSetting('report_price', v.toFixed(2)); // mantém legado em sincronia
      await logAdmin(req, 'set_price_single', `R$ ${v.toFixed(2)}`);
    }
    if (body.price_combo !== undefined) {
      const v = Number(body.price_combo);
      if (!(v > 0) || v > 999) return err(res, 'Preço do combo inválido (0,01 a 999).');
      await setSetting('price_combo', v.toFixed(2));
      await logAdmin(req, 'set_price_combo', `R$ ${v.toFixed(2)}`);
    }
    if (body.free_mode !== undefined) {
      await setSetting('free_mode', body.free_mode ? '1' : '0');
      await logAdmin(req, 'set_free_mode', body.free_mode ? 'ON' : 'OFF');
    }
    // custos de crédito por categoria
    if (body.credit_cost && typeof body.credit_cost === 'object') {
      for (const [cat, key] of Object.entries(CC_KEYS)) {
        if (body.credit_cost[cat] !== undefined) {
          const v = parseInt(body.credit_cost[cat], 10);
          if (!(v >= 0 && v <= 999)) return err(res, `Custo de crédito inválido para ${cat} (0–999).`);
          await setSetting(key, String(v));
        }
      }
      await logAdmin(req, 'set_credit_costs', JSON.stringify(body.credit_cost).slice(0, 120));
    }
    return json(res, await snapshot());
  }

  return err(res, 'op inválida (use get|set)');
};
