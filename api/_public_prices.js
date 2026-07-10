// GET /api/b2b?fn=public_prices — preços públicos (fonte única = app_settings, editável no admin).
// Sem autenticação, cacheável. A home, o checkout e o cabeçalho leem daqui, então
// mudar o preço no admin reflete em todos os canais automaticamente.
const { setCors, json } = require('./_lib/http');
const { getPriceSingle, getPriceSingleAnchor, getPriceCombo, DEFAULT_SINGLE, DEFAULT_SINGLE_BASE, DEFAULT_COMBO } = require('./_lib/settings');

function fmt(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }

module.exports = async (req, res) => {
  if (setCors(req, res)) return;

  let single = DEFAULT_SINGLE, combo = DEFAULT_COMBO, singleDe = DEFAULT_SINGLE_BASE;
  try { single = await getPriceSingle(); } catch (e) {}
  try { combo = await getPriceCombo(); } catch (e) {}
  try { singleDe = await getPriceSingleAnchor(); } catch (e) {}

  const de = +(single * 4).toFixed(2);           // preço "cheio" do combo (4 avulsos)
  const economia = Math.max(0, +(de - combo).toFixed(2));

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  return json(res, {
    ok: true,
    single, combo,
    single_fmt: fmt(single),
    combo_fmt: fmt(combo),
    // Âncora do Perfil Completo ("de R$99") + economia da promoção de lançamento.
    single_de: singleDe, single_de_fmt: fmt(singleDe),
    single_economia: Math.max(0, +(singleDe - single).toFixed(2)),
    single_economia_fmt: fmt(Math.max(0, +(singleDe - single).toFixed(2))),
    combo_de: de, combo_de_fmt: fmt(de),
    economia, economia_fmt: fmt(economia),
  });
};
