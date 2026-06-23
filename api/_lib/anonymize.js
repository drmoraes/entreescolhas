// ─────────────────────────────────────────────────────────────
// Identity Vault — separação entre dados identificáveis (PII) e exibíveis.
// anonymizeCandidate(): devolve um DTO SEM PII, com quase-identificadores
// generalizados, para a busca/listagem do RH antes do desbloqueio.
// revealCandidate(): devolve os dados completos (chamado SÓ após gasto de crédito).
// ─────────────────────────────────────────────────────────────

const { confidenceScore, adherenceScore, thermalState, isActive, haversineKm, distanceBucket } = require('./scoring');

// Campos que NUNCA podem sair antes do desbloqueio.
const PII_FIELDS = ['nome', 'email', 'telefone', 'linkedin', 'empresa', 'confirm_token', 'notes', 'cep', 'lat', 'lon'];

// Generaliza a cidade para região (reduz reidentificação por combinação).
const REGIOES = {
  'sao paulo': 'Grande SP', 'campinas': 'Interior SP', 'rio de janeiro': 'Grande Rio',
  'belo horizonte': 'Grande BH', 'curitiba': 'Grande Curitiba', 'porto alegre': 'Grande POA',
  'recife': 'Grande Recife', 'salvador': 'Grande Salvador', 'fortaleza': 'Grande Fortaleza',
  'brasilia': 'DF', 'florianopolis': 'Grande Floripa',
};
function generalizeCity(cidade) {
  if (!cidade) return 'Não informado';
  const k = String(cidade).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  for (const key of Object.keys(REGIOES)) if (k.includes(key)) return REGIOES[key];
  return 'Outras regiões';
}

// Generaliza o porte do empregador atual sem revelar o nome.
function generalizeEmployer(empresa) {
  if (!empresa) return null;
  return 'Empresa do setor (nome oculto)';
}

// Faixa salarial legível.
function salaryBand(min, max) {
  if (!min && !max) return null;
  const fmt = (v) => `R$${(Number(v) / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  return min ? `a partir de ${fmt(min)}` : `até ${fmt(max)}`;
}

// Apelido neutro a partir do pseudônimo (sem revelar identidade).
function aliasFromToken(token, area) {
  const tag = (token || '').slice(0, 4).toUpperCase();
  const base = area ? area : 'Candidato';
  return `${base} · #${tag}`;
}

// DTO anônimo para a vitrine do RH.
function anonymizeCandidate(c, criteria = {}) {
  const conf = confidenceScore(c);
  const adh = adherenceScore(c, criteria);
  // proximidade: só a FAIXA, nunca a localização exata
  const jLat = criteria.job_lat != null ? Number(criteria.job_lat) : null;
  const jLon = criteria.job_lon != null ? Number(criteria.job_lon) : null;
  const dist = (jLat != null && jLon != null) ? haversineKm(c.lat, c.lon, jLat, jLon) : null;
  return {
    proximidade: distanceBucket(dist),  // ex.: "até 5 km" | null se vaga sem local
    aceita_relocacao: c.aceita_relocacao,
    token: c.public_token,                 // pseudônimo opaco (chave de referência)
    alias: aliasFromToken(c.public_token, c.area),
    area: c.area || null,
    cargo: c.cargo || null,                // título do cargo (não identifica diretamente)
    senioridade: c.senioridade || null,
    experiencia: c.experiencia || null,
    escolaridade: c.escolaridade || null,
    regiao: generalizeCity(c.cidade),
    work_model: c.work_model || null,
    availability: c.availability || null,
    salary_band: salaryBand(c.salary_min, c.salary_max),
    empregador: generalizeEmployer(c.empresa),
    skills: Array.isArray(c.skills) ? c.skills : [],
    setores: Array.isArray(c.setores) ? c.setores : [],
    categoria: c.categoria || null,
    pcd: c.pcd === true,
    pcd_tipo: c.pcd ? (c.pcd_tipo || null) : null,
    arquetipo: c.arquetipo || null,
    arquetipo_scores: c.arquetipo_scores || null,
    adherence: adh.score,
    adherence_reasons: adh.reasons,
    confidence: conf.score,
    confidence_reasons: conf.reasons,
    active: conf.active,
    thermal: thermalState(c),
    // explicitamente AUSENTES: nome, email, telefone, linkedin, empresa, cidade exata, CPF
  };
}

// Dados completos — só pode ser chamado pelo serviço de desbloqueio autorizado.
function revealCandidate(c) {
  return {
    id: c.id,
    token: c.public_token,
    nome: c.nome,
    email: c.email,
    telefone: c.telefone,
    cidade: c.cidade,
    cep: c.cep,
    linkedin: c.linkedin,
    idiomas: Array.isArray(c.idiomas) ? c.idiomas : [],
    aceita_relocacao: c.aceita_relocacao,
    contrato: c.contrato,
    cargo: c.cargo,
    empresa: c.empresa,
    area: c.area,
    senioridade: c.senioridade,
    experiencia: c.experiencia,
    escolaridade: c.escolaridade,
    work_model: c.work_model,
    availability: c.availability,
    salary_min: c.salary_min,
    salary_max: c.salary_max,
    salary_band: salaryBand(c.salary_min, c.salary_max),
    skills: Array.isArray(c.skills) ? c.skills : [],
    setores: Array.isArray(c.setores) ? c.setores : [],
    categoria: c.categoria || null,
    pcd: c.pcd === true,
    pcd_tipo: c.pcd ? (c.pcd_tipo || null) : null,
    arquetipo: c.arquetipo,
    arquetipo_scores: c.arquetipo_scores,
    email_verified: c.email_verified,
    phone_verified: c.phone_verified,
    last_confirmed_at: c.last_confirmed_at,
  };
}

// Validação técnica de contato (formato) usada no ato do desbloqueio.
function validateContact(c) {
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email || ''));
  const digits = String(c.telefone || '').replace(/\D/g, '');
  const phoneOk = digits.length >= 10 && digits.length <= 13;
  return { valid: emailOk && phoneOk, emailOk, phoneOk };
}

module.exports = { anonymizeCandidate, revealCandidate, validateContact, generalizeCity, salaryBand, PII_FIELDS };
