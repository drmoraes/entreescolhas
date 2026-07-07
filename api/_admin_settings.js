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
      cortesia_codes: await getSetting('cortesia_codes', ''),
      cortesia_config: await getSetting('cortesia_config', '[]'),
      counter_base: parseInt(await getSetting('counter_base', '0'), 10) || 0,
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
    if (body.cortesia_codes !== undefined) {
      // Lista de códigos de cortesia (link ?cortesia=CODIGO libera grátis).
      const codes = String(body.cortesia_codes || '')
        .split(/[,\n;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      const uniq = [...new Set(codes)].slice(0, 100);
      await setSetting('cortesia_codes', uniq.join(', '));
      await logAdmin(req, 'set_cortesia_codes', uniq.join(', ').slice(0, 120));
    }
    if (body.cortesia_config !== undefined) {
      // Cortesia com validade + limite de usos. Array de {code, expires, max_uses}.
      // Preserva o contador `uses` já existente por código (merge por code).
      let prev = [];
      try { prev = JSON.parse(await getSetting('cortesia_config', '[]')) || []; } catch (e) { prev = []; }
      const prevUses = {};
      for (const p of prev) { if (p && p.code) prevUses[String(p.code).toUpperCase()] = parseInt(p.uses, 10) || 0; }
      const incoming = Array.isArray(body.cortesia_config) ? body.cortesia_config : [];
      const seen = new Set();
      const clean = [];
      for (const it of incoming) {
        const code = String((it && it.code) || '').trim().toUpperCase();
        if (!code || seen.has(code)) continue;
        seen.add(code);
        const expires = /^\d{4}-\d{2}-\d{2}$/.test(String(it.expires || '')) ? it.expires : '';
        const max_uses = Math.max(0, parseInt(it.max_uses, 10) || 0);
        clean.push({ code, expires, max_uses, uses: prevUses[code] || 0 });
        if (clean.length >= 100) break;
      }
      await setSetting('cortesia_config', JSON.stringify(clean));
      await logAdmin(req, 'set_cortesia_config', clean.map(c => c.code).join(', ').slice(0, 120));
    }
    if (body.counter_base !== undefined) {
      // "Ponto de partida" simbólico do contador público (prova social).
      const v = Math.max(0, Math.min(9999999, parseInt(body.counter_base, 10) || 0));
      await setSetting('counter_base', String(v));
      await logAdmin(req, 'set_counter_base', String(v));
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
