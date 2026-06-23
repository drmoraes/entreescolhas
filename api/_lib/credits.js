// Custo de crédito do desbloqueio por categoria de candidato.
// Categorias: operacional | analista | especialista | gerencial (+ regra PCD).
// PCD tem precedência (cota/inclusão — Lei 8.213/91): custo próprio, geralmente maior.
const { getCreditCosts } = require('./settings');

function strip(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const KW = {
  gerencial:    ['gerente', 'gestor', 'gestao', 'coordenador', 'coordenacao', 'supervisor', 'head', 'diretor', 'lideranca', 'lider', 'manager', 'chefe', 'encarregado'],
  especialista: ['especialista', 'senior', 'principal', 'staff', 'expert', 'arquiteto', 'consultor senior'],
  analista:     ['analista', 'pleno', 'analyst', 'consultor', 'tecnico', 'designer', 'desenvolvedor'],
  operacional:  ['operador', 'operacional', 'auxiliar', 'assistente', 'atendente', 'estagio', 'estagiario', 'junior', 'aprendiz', 'vendedor', 'caixa', 'repositor', 'recepcionista', 'balconista', 'motorista', 'estoquista', 'ajudante'],
};

// Deduz a categoria a partir do campo categoria (se houver) ou de senioridade/cargo.
function deriveCategoria(c) {
  const explicit = strip(c && c.categoria);
  if (['operacional', 'analista', 'especialista', 'gerencial'].includes(explicit)) return explicit;
  const hay = strip([c && c.cargo, c && c.senioridade].filter(Boolean).join(' '));
  // ordem: gerencial > especialista > operacional > analista (analista é o "meio" mais comum)
  for (const cat of ['gerencial', 'especialista', 'operacional', 'analista']) {
    if (KW[cat].some((k) => hay.includes(k))) return cat;
  }
  return 'operacional'; // default conservador (mais barato)
}

// Custo final + categoria efetiva. `costs` vem de getCreditCosts().
function creditCostFor(c, costs) {
  if (c && (c.pcd === true || c.pcd === 't' || c.pcd === 1)) {
    return { cost: Number(costs.pcd) || 8, categoria: 'pcd', pcd: true };
  }
  const cat = deriveCategoria(c);
  const cost = Number(costs[cat]);
  return { cost: (cost >= 0 ? cost : Number(costs.operacional) || 1), categoria: cat, pcd: false };
}

// Helper assíncrono: já busca os custos e calcula.
async function costForCandidate(c) {
  const costs = await getCreditCosts();
  return creditCostFor(c, costs);
}

module.exports = { deriveCategoria, creditCostFor, costForCandidate };
