// Permissões por papel para usuários INTERNOS (admin_users / painel).
// A chave mestra entra como role 'owner' (acesso total).
const ACAP = {
  owner:      ['view', 'grant_credits', 'coupons', 'cortesias', 'tests', 'candidates', 'company_users', 'admin_users'],
  financeiro: ['view', 'grant_credits', 'coupons', 'cortesias'],
  suporte:    ['view', 'cortesias', 'tests', 'candidates', 'company_users'],
  leitura:    ['view'],
};

const CAP_LABEL = {
  grant_credits: 'conceder créditos',
  coupons: 'gerenciar cupons',
  cortesias: 'liberar cortesias (teste grátis)',
  tests: 'reiniciar testes',
  candidates: 'editar candidatos',
  company_users: 'gerenciar usuários de empresa',
  admin_users: 'gerenciar usuários internos',
};

function adminCan(role, cap) {
  if (!role) return false;
  return (ACAP[role] || ACAP.leitura).includes(cap);
}

module.exports = { adminCan, ACAP, CAP_LABEL };
