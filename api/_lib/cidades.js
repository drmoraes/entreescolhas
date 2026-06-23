// Coordenadas das principais cidades do Brasil (capitais + grandes metrópoles).
// Usado para dar lat/lon às vagas quando a fonte (ex.: Adzuna) não envia coordenadas,
// habilitando o "perto de você". Cobre a maioria das vagas reais.
const CIDADES = {
  'sao paulo': [-23.55, -46.63], 'rio de janeiro': [-22.91, -43.17], 'brasilia': [-15.79, -47.88],
  'salvador': [-12.97, -38.50], 'fortaleza': [-3.73, -38.52], 'belo horizonte': [-19.92, -43.94],
  'manaus': [-3.10, -60.02], 'curitiba': [-25.43, -49.27], 'recife': [-8.05, -34.88],
  'goiania': [-16.69, -49.26], 'belem': [-1.46, -48.50], 'porto alegre': [-30.03, -51.23],
  'guarulhos': [-23.46, -46.53], 'campinas': [-22.91, -47.06], 'sao luis': [-2.53, -44.30],
  'maceio': [-9.67, -35.74], 'natal': [-5.79, -35.21], 'campo grande': [-20.47, -54.62],
  'teresina': [-5.09, -42.80], 'joao pessoa': [-7.12, -34.86], 'sao bernardo do campo': [-23.69, -46.56],
  'osasco': [-23.53, -46.79], 'santo andre': [-23.66, -46.53], 'jaboatao dos guararapes': [-8.11, -35.01],
  'contagem': [-19.93, -44.05], 'uberlandia': [-18.91, -48.27], 'sorocaba': [-23.50, -47.46],
  'aracaju': [-10.91, -37.07], 'feira de santana': [-12.27, -38.97], 'cuiaba': [-15.60, -56.10],
  'joinville': [-26.30, -48.85], 'juiz de fora': [-21.76, -43.35], 'londrina': [-23.31, -51.16],
  'aparecida de goiania': [-16.82, -49.24], 'niteroi': [-22.88, -43.10], 'porto velho': [-8.76, -63.90],
  'campos dos goytacazes': [-21.75, -41.33], 'caxias do sul': [-29.17, -51.18], 'florianopolis': [-27.59, -48.55],
  'vila velha': [-20.33, -40.29], 'macapa': [0.03, -51.07], 'sao jose dos campos': [-23.18, -45.89],
  'ribeirao preto': [-21.18, -47.81], 'maua': [-23.67, -46.46], 'sao joao de meriti': [-22.80, -43.37],
  'mogi das cruzes': [-23.52, -46.19], 'betim': [-19.97, -44.20], 'diadema': [-23.69, -46.62],
  'campina grande': [-7.23, -35.88], 'jundiai': [-23.19, -46.88], 'maringa': [-23.42, -51.94],
  'montes claros': [-16.73, -43.86], 'piracicaba': [-22.72, -47.65], 'carapicuiba': [-23.52, -46.84],
  'olinda': [-8.01, -34.86], 'cariacica': [-20.26, -40.42], 'bauru': [-22.31, -49.06],
  'anapolis': [-16.33, -48.95], 'vitoria': [-20.32, -40.34], 'caucaia': [-3.73, -38.65],
  'pelotas': [-31.77, -52.34], 'vitoria da conquista': [-14.86, -40.84], 'caruaru': [-8.28, -35.97],
  'blumenau': [-26.92, -49.07], 'ponta grossa': [-25.09, -50.16], 'petrolina': [-9.39, -40.50],
  'franca': [-20.54, -47.40], 'canoas': [-29.92, -51.18], 'uberaba': [-19.75, -47.93],
  'limeira': [-22.56, -47.40], 'maraba': [-5.37, -49.13], 'santos': [-23.96, -46.33],
  'sao jose do rio preto': [-20.81, -49.38], 'taubate': [-23.03, -45.55], 'governador valadares': [-18.85, -41.95],
  'volta redonda': [-22.52, -44.10], 'varzea grande': [-15.65, -56.13], 'petropolis': [-22.51, -43.18]
};

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Recebe "São Paulo, Estado de São Paulo" e tenta achar a cidade na tabela.
function cityCoords(cidadeStr) {
  if (!cidadeStr) return null;
  const partes = String(cidadeStr).split(',').map((p) => norm(p)).filter(Boolean);
  for (const p of partes) { if (CIDADES[p]) return CIDADES[p]; }
  // tenta casar por "contém" (ex.: "zona sul de São Paulo")
  const full = norm(cidadeStr);
  for (const k of Object.keys(CIDADES)) { if (full.includes(k)) return CIDADES[k]; }
  return null;
}

module.exports = { CIDADES, cityCoords, norm };
