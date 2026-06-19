// ─────────────────────────────────────────────────────────────
// Scoring: Aderência (fit candidato↔vaga) e Confiança/Responsividade.
// Funções puras e auditáveis — sem caixa-preta. Cada score expõe o "porquê".
// NUNCA usa atributos sensíveis (idade, gênero, PCD, etc.) como feature.
// ─────────────────────────────────────────────────────────────

const SENIORITY_RANK = {
  estagio: 1, junior: 2, pleno: 3, senior: 4, especialista: 5, lideranca: 6, gestao: 6,
};
function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function seniorityRank(s) {
  if (!s) return 0;
  const k = stripAccents(String(s).toLowerCase());
  for (const key of Object.keys(SENIORITY_RANK)) if (k.includes(key)) return SENIORITY_RANK[key];
  return 0;
}

function norm(s) {
  return stripAccents(String(s || '').toLowerCase()).trim();
}

function daysSince(date) {
  if (!date) return Infinity;
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d)) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ── Score de Confiança / Responsividade (0-100) ──────────────
// Mede a probabilidade de o candidato estar ativo e responder.
function confidenceScore(c) {
  const reasons = [];
  let score = 0;

  // Recência da última confirmação de interesse (até 40 pts)
  const d = daysSince(c.last_confirmed_at);
  let rec;
  if (d <= 15) rec = 40;
  else if (d <= 30) rec = 34;
  else if (d <= 45) rec = 26;
  else if (d <= 90) rec = 14;
  else if (d <= 180) rec = 6;
  else rec = 0;
  score += rec;
  reasons.push({ fator: 'Confirmação de interesse', pontos: rec, max: 40,
    detalhe: d === Infinity ? 'nunca confirmou' : `há ${d} dia(s)` });

  // Verificação de contato (até 25 pts)
  let verif = 0;
  if (c.email_verified) verif += 15;
  if (c.phone_verified) verif += 10;
  score += verif;
  reasons.push({ fator: 'Contato verificado', pontos: verif, max: 25,
    detalhe: [c.email_verified ? 'e-mail' : null, c.phone_verified ? 'telefone' : null].filter(Boolean).join(' + ') || 'não verificado' });

  // Taxa histórica de resposta a convites (até 25 pts)
  const inv = Number(c.invites_total) || 0;
  const resp = Number(c.responses_received) || 0;
  let rate = 0, ratePct = null;
  if (inv > 0) {
    ratePct = resp / inv;
    rate = Math.round(ratePct * 25);
  } else {
    rate = 12; // sem histórico: neutro
  }
  score += rate;
  reasons.push({ fator: 'Responsividade histórica', pontos: rate, max: 25,
    detalhe: inv > 0 ? `${resp}/${inv} convites (${Math.round(ratePct * 100)}%)` : 'sem histórico' });

  // Completude do perfil (até 10 pts)
  const filled = ['cargo', 'senioridade', 'cidade', 'area'].filter((f) => c[f]).length;
  const skills = Array.isArray(c.skills) ? c.skills.length : 0;
  let comp = Math.min(10, filled * 2 + (skills > 0 ? 2 : 0));
  score += comp;
  reasons.push({ fator: 'Completude do perfil', pontos: comp, max: 10, detalhe: `${filled} campos + ${skills} skills` });

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, reasons, active: isActive(c) };
}

// "Candidato Ativo": confirmou interesse nos últimos 45 dias.
function isActive(c) {
  return daysSince(c.last_confirmed_at) <= 45;
}

// Estado térmico do perfil para regras de exposição.
function thermalState(c) {
  const d = daysSince(c.last_confirmed_at);
  if (d <= 45) return 'ativo';
  if (d <= 90) return 'morno';
  return 'frio';
}

// ── Score de Aderência (0-100) ───────────────────────────────
// Mede o fit entre o candidato e os critérios da busca/vaga.
// criteria: { skills:[], senioridade, work_model, cidade, salary_max, availability }
function adherenceScore(c, criteria = {}) {
  const reasons = [];
  let score = 0;

  // Skills (35)
  const want = (criteria.skills || []).map(norm).filter(Boolean);
  const have = (Array.isArray(c.skills) ? c.skills : []).map(norm);
  let skillPts;
  if (want.length === 0) {
    skillPts = 24; // sem exigência de skills → neutro-positivo
    reasons.push({ criterio: 'Skills', pontos: skillPts, max: 35, detalhe: 'sem skill exigida' });
  } else {
    const matched = want.filter((w) => have.some((h) => h.includes(w) || w.includes(h)));
    skillPts = Math.round((matched.length / want.length) * 35);
    reasons.push({ criterio: 'Skills', pontos: skillPts, max: 35,
      detalhe: `${matched.length}/${want.length} (${matched.join(', ') || '—'})` });
  }
  score += skillPts;

  // Senioridade (20)
  let senPts = 12;
  if (criteria.senioridade) {
    const want = seniorityRank(criteria.senioridade);
    const have = seniorityRank(c.senioridade);
    if (want && have) {
      const diff = Math.abs(want - have);
      senPts = diff === 0 ? 20 : diff === 1 ? 14 : diff === 2 ? 7 : 2;
    }
    reasons.push({ criterio: 'Senioridade', pontos: senPts, max: 20, detalhe: `${c.senioridade || '—'} vs ${criteria.senioridade}` });
  } else {
    reasons.push({ criterio: 'Senioridade', pontos: senPts, max: 20, detalhe: 'sem exigência' });
  }
  score += senPts;

  // Localização / modelo (15)
  let locPts = 10;
  if (criteria.work_model && norm(criteria.work_model) === 'remoto') {
    locPts = 15; // remoto: localização não restringe
    reasons.push({ criterio: 'Localização/modelo', pontos: locPts, max: 15, detalhe: 'vaga remota' });
  } else if (criteria.cidade) {
    locPts = norm(c.cidade).includes(norm(criteria.cidade)) ? 15 : 5;
    reasons.push({ criterio: 'Localização/modelo', pontos: locPts, max: 15, detalhe: `${c.cidade || '—'} vs ${criteria.cidade}` });
  } else {
    reasons.push({ criterio: 'Localização/modelo', pontos: locPts, max: 15, detalhe: 'sem exigência' });
  }
  score += locPts;

  // Pretensão salarial (15) — cabe no budget?
  let salPts = 10;
  if (criteria.salary_max) {
    const cMin = Number(c.salary_min) || 0;
    if (cMin === 0) { salPts = 10; }
    else if (cMin <= Number(criteria.salary_max)) { salPts = 15; }
    else if (cMin <= Number(criteria.salary_max) * 1.15) { salPts = 8; }
    else { salPts = 2; }
    reasons.push({ criterio: 'Pretensão salarial', pontos: salPts, max: 15,
      detalhe: cMin ? `R$${cMin} vs budget R$${criteria.salary_max}` : 'não informada' });
  } else {
    reasons.push({ criterio: 'Pretensão salarial', pontos: salPts, max: 15, detalhe: 'sem budget definido' });
  }
  score += salPts;

  // Disponibilidade (15)
  const availMap = { imediata: 15, '30d': 12, '60d': 8, '90d': 4 };
  let availPts = availMap[norm(c.availability)] ?? 8;
  reasons.push({ criterio: 'Disponibilidade', pontos: availPts, max: 15, detalhe: c.availability || 'não informada' });
  score += availPts;

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, reasons };
}

module.exports = { confidenceScore, adherenceScore, isActive, thermalState, seniorityRank, daysSince };
