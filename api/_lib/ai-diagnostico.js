// Núcleo do "Diagnóstico por IA" — relatório psicométrico executivo premium.
// Gera 7 seções sofisticadas a partir do resultado do teste + (opcional) do
// contexto do cliente (senioridade, segmento, maior desafio).
//
// Guarda-corpos de linguagem (mantidos do produto): NÃO é teste psicológico e
// NÃO emite diagnóstico clínico. Usar "você tende a" / "nas situações do teste"
// em vez de "você é". "Notas baixas" nunca são fracasso — são tendências e
// possíveis descarrilhadores sob pressão.
//
// Provider: usa a chave que estiver no ambiente — Gemini (GEMINI_API_KEY ou
// GOOGLE_API_KEY) OU OpenAI (OPENAI_API_KEY). Sem chave, cai num gerador
// determinístico (mock) com o MESMO schema, então o produto funciona ponta a
// ponta hoje.
//
// Schema retornado (chaves):
//   alinhamento (string), mapa_potencia [{titulo,texto} x3],
//   descarrilhamento [{titulo,texto}], roi_ambiente (string),
//   comparativo [{dimensao,percent,status} x4], veredito (string),
//   plano_acao [string x3], gerado_por

const COMPETENCIAS = {
  arquetipo: {
    SIS: 'Organização e planejamento', AMB: 'Tolerância à ambiguidade', VEL: 'Velocidade de decisão',
    REL: 'Colaboração e empatia', EXE: 'Execução e iniciativa', EMO: 'Gestão emocional sob pressão',
  },
  'fit-cultural': {
    AUT: 'Autonomia', PRO: 'Disciplina de processo', INO: 'Inovação',
    IMP: 'Orientação a impacto coletivo', COL: 'Colaboração', SEG: 'Busca por estabilidade',
  },
  scanner: {
    ASS: 'Assertividade', EMP: 'Empatia e escuta ativa', INF: 'Influência e persuasão',
    MED: 'Mediação de conflitos', NET: 'Construção de rede', INT: 'Profundidade relacional',
  },
  bussola: {
    PRO: 'Propósito e missão', IMP: 'Orientação a impacto', SEG: 'Segurança e estabilidade',
    CRI: 'Criatividade e expressão', REC: 'Busca por reconhecimento', AUT: 'Autonomia de carreira',
  },
};
const TEMAS = {
  arquetipo: 'como você toma decisões em cenários reais',
  'fit-cultural': 'em que tipo de ambiente você performa melhor',
  scanner: 'como você se comporta em situações de relacionamento e conflito',
  bussola: 'o que move suas escolhas de carreira',
};

function nomeDim(jornada, dimNames, k) {
  const map = COMPETENCIAS[jornada] || COMPETENCIAS.arquetipo;
  return (dimNames && dimNames[k]) || map[k] || k;
}
function ordenar(scores, dimKeys) {
  return dimKeys.map(k => [k, Number(scores[k] || 0)]).sort((a, b) => b[1] - a[1]);
}
function statusMercado(v) { return v >= 72 ? 'Destaque' : v >= 55 ? 'Alinhado' : 'Atenção'; }
function ctxTexto(ctx) {
  if (!ctx) return '';
  const p = [];
  if (ctx.senioridade) p.push('Senioridade: ' + ctx.senioridade);
  if (ctx.segmento) p.push('Segmento: ' + ctx.segmento);
  if (ctx.desafio) p.push('Maior desafio atual: ' + ctx.desafio);
  return p.join('\n');
}

// ── Gerador determinístico (sem chave / rede de segurança) ──
function gerarMock(jornada, archName, scores, dimNames, ctx) {
  const map = COMPETENCIAS[jornada] || COMPETENCIAS.arquetipo;
  const dimKeys = Object.keys(dimNames && Object.keys(dimNames).length ? dimNames : map);
  const ord = ordenar(scores, dimKeys);
  const top = ord.slice(0, 3);
  const bottom = ord.slice(-2).reverse();
  const nomeT = k => nomeDim(jornada, dimNames, k);
  const tema = TEMAS[jornada] || 'seu comportamento real';
  const sen = (ctx && ctx.senioridade) || 'seu nível atual';
  const desafio = (ctx && ctx.desafio) ? ('“' + ctx.desafio + '”') : 'o seu momento de carreira';

  const mapa_potencia = top.map(([k], i) => ({
    titulo: nomeT(k),
    texto: `Aparece entre as suas dimensões mais acionadas nas situações do teste. ${i === 0 ? `É o seu principal recurso pra atacar ${desafio}: use-o de forma intencional, e não só quando "acontece".` : 'Combine com sua força principal para ampliar seu raio de atuação.'}`,
  }));
  const descarrilhamento = bottom.map(([k]) => ({
    titulo: nomeT(k),
    texto: `Sob fadiga ou pressão intensa, essa é a tendência que menos aparece nas suas escolhas — e costuma ser o ponto cego que só é notado quando alguém de fora aponta. Não é falta de capacidade; é onde seu padrão te protege, mas pode te limitar em contextos que exigem exatamente isso.`,
  }));
  const comparativo = [...top.slice(0, 2), ...bottom].map(([k, v]) => ({
    dimensao: nomeT(k), percent: Math.round(v), status: statusMercado(v),
  }));

  return {
    alinhamento: `Antes de tudo: este diagnóstico não mede inteligência nem competência técnica — mapeia tendências de comportamento sob pressão, observadas nas situações do teste. Pontuações mais baixas costumam indicar foco e independência; muito altas podem indicar rigidez. Não existe "certo" ou "errado" aqui, existe padrão — e padrão consciente vira vantagem.`,
    mapa_potencia,
    descarrilhamento,
    roi_ambiente: `Você tende a render mais em contextos que valorizam ${nomeT(top[0][0]).toLowerCase()} e dão espaço pra ${nomeT(top[1] ? top[1][0] : top[0][0]).toLowerCase()}. Ambientes que exigem o tempo todo ${nomeT(bottom[0][0]).toLowerCase()} tendem a te desgastar — nesses, delegar ou construir parcerias complementares libera a sua melhor entrega. Considerando ${sen}, priorize projetos onde sua força principal seja o diferencial, não a exceção.`,
    comparativo,
    veredito: `Cruzando o seu padrão (${archName ? 'perfil ' + archName + ', ' : ''}${tema}) com ${desafio}, a hipótese madura é: o gargalo raramente é falta de força — é depender demais do seu recurso mais forte e evitar as situações que exigem ${nomeT(bottom[0][0]).toLowerCase()}. O próximo salto vem de expor-se, de forma controlada, exatamente ao que você hoje evita.`,
    plano_acao: [
      `Esta semana: escolha 1 situação real ligada a ${desafio} e resolva usando deliberadamente a sua força de ${nomeT(top[0][0]).toLowerCase()} — registre o resultado.`,
      `Nos próximos 15 dias: coloque-se de propósito em 1 contexto que exija ${nomeT(bottom[0][0]).toLowerCase()}, mesmo desconfortável, e observe o que trava.`,
      `Peça a alguém de confiança (líder, mentor ou par) um feedback direto sobre o seu ponto cego — e transforme em 1 combinado concreto de mudança.`,
    ],
    gerado_por: 'modelo',
  };
}

// ── Prompt premium (compartilhado entre providers) ──
function montarPrompts(jornada, archName, scores, dimNames, ctx) {
  const map = COMPETENCIAS[jornada] || COMPETENCIAS.arquetipo;
  const dimKeys = Object.keys(dimNames && Object.keys(dimNames).length ? dimNames : map);
  const linhas = ordenar(scores, dimKeys).map(([k, v]) => `- ${nomeDim(jornada, dimNames, k)}: ${Math.round(v)}/100`).join('\n');

  const system =
    'Você é um Assessor Executivo Sênior e Psicometrista de elite (desenvolvimento de lideranças, riscos de descarrilhamento, alta performance). ' +
    'Gere um relatório psicométrico profundo, sofisticado e de altíssimo valor — o cliente pagou por um diagnóstico premium. Proibido: respostas rasas, jargão genérico de RH, positividade tóxica. ' +
    'GUARDA-CORPOS OBRIGATÓRIOS: este NÃO é um teste psicológico e NÃO emite diagnóstico clínico; use sempre "você tende a", "nas situações do teste", "isso sugere" — NUNCA "você é" nem rótulos fixos. ' +
    'Jamais trate pontuação baixa como fracasso: extremos indicam tendências e possíveis descarrilhadores sob pressão; pontuações baixas podem indicar foco/independência, altas podem indicar rigidez. ' +
    'Calibre o vocabulário pela senioridade informada. Todo o diagnóstico deve orbitar o maior desafio atual do cliente quando informado. ' +
    'Responda SEMPRE em português do Brasil, em JSON puro (sem markdown), com EXATAMENTE estas chaves: ' +
    '"alinhamento" (1 parágrafo blindando o ego: mapeia tendências sob pressão, não capacidade; remove a ideia de fracasso), ' +
    '"mapa_potencia" (array com EXATAMENTE 3 objetos {"titulo","texto"} — as 3 maiores forças, cada uma cruzada com o desafio atual: como usar essa força pra resolver o problema dele), ' +
    '"descarrilhamento" (array com 2 a 3 objetos {"titulo","texto"} — onde ele falha sob fadiga/estresse, gatilhos que neutralizam as forças; duro, mas com elegância corporativa), ' +
    '"roi_ambiente" (1 parágrafo: projetos/estruturas/culturas/times onde brilha, e o que deve delegar pra não travar), ' +
    '"comparativo" (array com EXATAMENTE 4 objetos {"dimensao","percent","status"} — percent inteiro 0-100 baseado nas notas recebidas; status igual a "Atenção", "Alinhado" ou "Destaque"; é um comparativo ILUSTRATIVO/referencial, não estatística real), ' +
    '"veredito" (1 parágrafo: síntese madura cruzando contexto + inventário, com hipótese sobre o próximo passo de carreira), ' +
    '"plano_acao" (array com EXATAMENTE 3 strings — PDI de curtíssimo prazo, execução imediata, focado no desafio atual). ' +
    'Cada bloco deve se basear nas notas recebidas, nunca em generalidades vagas.';

  const user =
    `Jornada: ${jornada} (tema: ${TEMAS[jornada] || 'comportamento em cenários reais'})\n` +
    `Perfil predominante: ${archName || 'não identificado'}\n` +
    (ctxTexto(ctx) ? (ctxTexto(ctx) + '\n') : 'Contexto do cliente: não informado (gere a partir do inventário).\n') +
    `Notas por dimensão (índice de ênfase 40–100):\n${linhas}`;

  return { system, user };
}

const CHAVES = ['alinhamento', 'mapa_potencia', 'descarrilhamento', 'roi_ambiente', 'comparativo', 'veredito', 'plano_acao'];
function validar(p) {
  if (!p || typeof p !== 'object') return null;
  for (const c of CHAVES) if (p[c] == null) return null;
  if (!Array.isArray(p.mapa_potencia) || p.mapa_potencia.length < 3) return null;
  if (!Array.isArray(p.descarrilhamento) || !p.descarrilhamento.length) return null;
  if (!Array.isArray(p.comparativo) || p.comparativo.length < 3) return null;
  if (!Array.isArray(p.plano_acao) || p.plano_acao.length < 3) return null;
  const clampBlk = a => a.slice(0, 4).map(o => ({ titulo: String(o.titulo || '').slice(0, 80), texto: String(o.texto || '').slice(0, 700) }));
  return {
    alinhamento: String(p.alinhamento).slice(0, 900),
    mapa_potencia: clampBlk(p.mapa_potencia).slice(0, 3),
    descarrilhamento: clampBlk(p.descarrilhamento),
    roi_ambiente: String(p.roi_ambiente).slice(0, 900),
    comparativo: p.comparativo.slice(0, 4).map(o => ({
      dimensao: String(o.dimensao || '').slice(0, 60),
      percent: Math.max(0, Math.min(100, parseInt(o.percent, 10) || 0)),
      status: ['Atenção', 'Alinhado', 'Destaque'].includes(o.status) ? o.status : 'Alinhado',
    })),
    veredito: String(p.veredito).slice(0, 900),
    plano_acao: p.plano_acao.slice(0, 3).map(s => String(s).slice(0, 400)),
    gerado_por: 'ia',
  };
}
function extrairJson(txt) {
  try { return JSON.parse(txt); } catch (e) {}
  const m = String(txt || '').match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

// ── Gemini ──
async function gerarGemini(prompts) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompts.system }] },
        contents: [{ role: 'user', parts: [{ text: prompts.user }] }],
        generationConfig: { temperature: 0.6, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) { console.error('ai-diagnostico: Gemini', r.status); return null; }
    const data = await r.json();
    const txt = data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    return validar(extrairJson(txt));
  } catch (e) { console.error('ai-diagnostico: falha Gemini —', e.message); return null; }
}

// ── OpenAI ──
async function gerarOpenAI(prompts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompts.system }, { role: 'user', content: prompts.user }],
        temperature: 0.6, response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) { console.error('ai-diagnostico: OpenAI', r.status); return null; }
    const data = await r.json();
    const txt = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return validar(extrairJson(txt));
  } catch (e) { console.error('ai-diagnostico: falha OpenAI —', e.message); return null; }
}

// Ponto de entrada único: tenta Gemini → OpenAI → mock (nunca quebra).
async function gerarDiagnostico({ jornada, archName, scores, dimNames, contexto }) {
  const prompts = montarPrompts(jornada, archName, scores, dimNames, contexto);
  const viaGemini = await gerarGemini(prompts);
  if (viaGemini) return viaGemini;
  const viaOpenAI = await gerarOpenAI(prompts);
  if (viaOpenAI) return viaOpenAI;
  return gerarMock(jornada, archName, scores, dimNames, contexto);
}

module.exports = { gerarDiagnostico, COMPETENCIAS, TEMAS };
