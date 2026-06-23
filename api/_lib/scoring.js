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

// Distância em km entre dois pontos (Haversine).
function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || isNaN(v))) return null;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Faixa de distância exibível ao RH (sem revelar localização exata).
function distanceBucket(km) {
  if (km == null) return null;
  if (km <= 5) return 'até 5 km';
  if (km <= 15) return '5–15 km';
  if (km <= 30) return '15–30 km';
  if (km <= 60) return '30–60 km';
  return 'mais de 60 km';
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

  // Competências & experiência (35) — não privilegia só skill técnica.
  // O "repertório" inclui skills + setores de experiência + cargo + área +
  // texto de experiência. Assim, quem veio de varejo, farmácia, mercado,
  // atendimento etc. é reconhecido, não só perfis técnicos.
  const want = [...(criteria.skills || []), criteria.setor].map(norm).filter(Boolean);
  const setoresArr = Array.isArray(c.setores) ? c.setores : [];
  const have = [
    ...(Array.isArray(c.skills) ? c.skills : []),
    ...setoresArr, c.cargo, c.area, c.experiencia,
  ].map(norm).filter(Boolean);
  const temRepertorio = (Array.isArray(c.skills) && c.skills.length > 0) || setoresArr.length > 0 || !!c.experiencia;
  let skillPts;
  if (want.length === 0) {
    skillPts = temRepertorio ? 30 : 24; // sem exigência → neutro-positivo
    reasons.push({ criterio: 'Competências & experiência', pontos: skillPts, max: 35,
      detalhe: temRepertorio ? 'repertório considerado (skills/setores/experiência)' : 'sem exigência específica' });
  } else {
    const matched = want.filter((w) => have.some((h) => h.includes(w) || w.includes(h)));
    let pts = (matched.length / want.length) * 35;
    if (matched.length === 0 && temRepertorio) pts = 8; // piso p/ experiência diversa
    skillPts = Math.round(pts);
    reasons.push({ criterio: 'Competências & experiência', pontos: skillPts, max: 35,
      detalhe: `${matched.length}/${want.length} (${matched.join(', ') || (temRepertorio ? 'experiência relacionada' : '—')})` });
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

  // Localização / proximidade (15)
  let locPts = 10;
  const jobLat = criteria.job_lat != null ? Number(criteria.job_lat) : null;
  const jobLon = criteria.job_lon != null ? Number(criteria.job_lon) : null;
  const dist = (jobLat != null && jobLon != null) ? haversineKm(c.lat, c.lon, jobLat, jobLon) : null;
  if (criteria.work_model && norm(criteria.work_model) === 'remoto') {
    locPts = 15; // remoto: localização não restringe
    reasons.push({ criterio: 'Localização/proximidade', pontos: locPts, max: 15, detalhe: 'vaga remota' });
  } else if (dist != null) {
    // proximidade casa↔vaga (perto = mais pontos)
    locPts = dist <= 5 ? 15 : dist <= 15 ? 12 : dist <= 30 ? 8 : dist <= 60 ? 4 : 2;
    reasons.push({ criterio: 'Localização/proximidade', pontos: locPts, max: 15, detalhe: distanceBucket(dist) + ' da vaga' });
  } else if (criteria.cidade) {
    locPts = norm(c.cidade).includes(norm(criteria.cidade)) ? 15 : 5;
    reasons.push({ criterio: 'Localização/proximidade', pontos: locPts, max: 15, detalhe: `${c.cidade || '—'} vs ${criteria.cidade}` });
  } else {
    reasons.push({ criterio: 'Localização/proximidade', pontos: locPts, max: 15, detalhe: 'sem exigência' });
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

module.exports = { confidenceScore, adherenceScore, isActive, thermalState, seniorityRank, daysSince, haversineKm, distanceBucket };
