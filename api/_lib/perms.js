// Permissões por papel para usuários de EMPRESA (Portal RH).
// Use can(role, cap) para liberar/bloquear ações. 'recruiter' (legado) ~ 'analista'.
const CAP = {
  owner:    ['search', 'unlock', 'invite', 'buy', 'manage_users', 'view'],
  gestor:   ['search', 'unlock', 'invite', 'buy', 'view'],
  analista: ['search', 'unlock', 'invite', 'view'],
  recruiter:['search', 'unlock', 'invite', 'view'],
  leitura:  ['search', 'view'],
};

const ROLE_LABEL = {
  owner: 'Owner (admin da empresa)',
  gestor: 'Gestor de RH',
  analista: 'Analista / Recrutador',
  recruiter: 'Recrutador',
  leitura: 'Leitura',
};

function can(role, cap) {
  return (CAP[role] || CAP.leitura).includes(cap);
}

module.exports = { can, CAP, ROLE_LABEL };
