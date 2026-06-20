// Geocodificação de CEP no servidor, com fallback robusto.
// 1) BrasilAPI v2 (coordenadas exatas quando o provedor tem)
// 2) Centroide aproximado por prefixo de CEP (quando não há coordenada exata)
// Usado pela busca para calcular a proximidade casa↔vaga sem depender do cliente.

const fetchFn = (typeof fetch === 'function') ? fetch : null;

// Centroides aproximados por prefixo (2 primeiros dígitos do CEP) das principais regiões.
// Servem só de fallback — a faixa de distância é uma aproximação quando exato não existe.
const PREFIX = {
  // São Paulo capital + Grande SP
  '01': [-23.5505, -46.6333], '02': [-23.5000, -46.6200], '03': [-23.5500, -46.5700],
  '04': [-23.6100, -46.6400], '05': [-23.5400, -46.7200], '06': [-23.5300, -46.8500],
  '07': [-23.4500, -46.5300], '08': [-23.5400, -46.4000], '09': [-23.6600, -46.5300],
  // Rio de Janeiro
  '20': [-22.9068, -43.1729], '21': [-22.8800, -43.2800], '22': [-22.9700, -43.1900], '23': [-22.9200, -43.5500],
  // Belo Horizonte
  '30': [-19.9167, -43.9345], '31': [-19.8600, -43.9500],
  // Salvador
  '40': [-12.9777, -38.5016], '41': [-12.9400, -38.4300], '42': [-12.9000, -38.4000],
  // Recife
  '50': [-8.0476, -34.8770], '51': [-8.1200, -34.9000], '52': [-8.0200, -34.9500],
  // Fortaleza
  '60': [-3.7319, -38.5267], '61': [-3.8000, -38.5500],
  // Brasília / DF
  '70': [-15.7939, -47.8828], '71': [-15.8300, -47.9500], '72': [-15.8500, -48.1000], '73': [-15.6300, -47.6300],
  // Curitiba
  '80': [-25.4284, -49.2733], '81': [-25.5000, -49.2500], '82': [-25.3800, -49.2200],
  // Florianópolis
  '88': [-27.5949, -48.5482],
  // Porto Alegre
  '90': [-30.0346, -51.2177], '91': [-30.0500, -51.1800],
};

function prefixCentroid(cep8) {
  const p = cep8.slice(0, 2);
  return PREFIX[p] || null;
}

async function geocodeCep(cep) {
  const c = String(cep || '').replace(/\D/g, '');
  if (c.length !== 8) return null;

  // 1) BrasilAPI v2 (coordenadas exatas quando disponíveis)
  if (fetchFn) {
    try {
      const opts = {};
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(3500);
      const r = await fetchFn('https://brasilapi.com.br/api/cep/v2/' + c, opts);
      if (r.ok) {
        const j = await r.json();
        const co = j.location && j.location.coordinates;
        if (co && co.latitude) {
          return { lat: Number(co.latitude), lon: Number(co.longitude), city: j.city, state: j.state, exact: true };
        }
        const f = prefixCentroid(c);
        if (f) return { lat: f[0], lon: f[1], city: j.city, state: j.state, exact: false };
      }
    } catch (e) { /* timeout/erro de rede → cai no fallback */ }
  }

  // 2) fallback por prefixo
  const f = prefixCentroid(c);
  if (f) return { lat: f[0], lon: f[1], exact: false };
  return null;
}

module.exports = { geocodeCep, prefixCentroid };
