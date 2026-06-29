// Núcleo do "Diagnóstico de Coaching" — conecta o resultado de cada jornada a
// competências comportamentais e gera um relatório de coaching de 11 blocos,
// no tema único do Entre Escolhas: comportamento em cenários reais.
//
// Regras de linguagem (não-clínicas, não-rotuladoras): usar sempre "você tende
// a" / "nas situações do teste, você..." em vez de "você é" — o diagnóstico
// descreve tendências observadas no teste, nunca um diagnóstico fixo ou clínico.
//
// Sem OPENAI_API_KEY configurada: usa um gerador determinístico (mock) com os
// mesmos 11 campos, então o produto funciona ponta a ponta hoje. Quando a chave
// for adicionada ao ambiente, passa a chamar a API da OpenAI automaticamente —
// nenhuma mudança de código é necessária na troca.
//
// Estrutura de 11 blocos (chaves do objeto retornado):
//   resumo_executivo, padroes_decisao, estilo_relacionamento, ponto_forte,
//   ponto_cego, riscos_comportamentais, sugestao_carreira, plano_7_dias,
//   plano_30_dias, perguntas_coaching (array de 3), recomendacoes_conversa

// Competências comportamentais por jornada (cada teste usa 6 dimensões próprias).
const COMPETENCIAS = {
  arquetipo: {
    SIS: { nome: 'Organização e planejamento', acao: 'Antes da próxima decisão importante, escreva 3 passos no papel antes de agir — teste o método por uma semana.' },
    AMB: { nome: 'Tolerância à ambiguidade', acao: 'Escolha uma situação sem roteiro definido nesta semana e decida sem esperar ter 100% de clareza antes.' },
    VEL: { nome: 'Velocidade de decisão', acao: 'Pratique decidir com um prazo curto (10 minutos) numa escolha de baixo risco esta semana.' },
    REL: { nome: 'Colaboração e empatia', acao: 'Na próxima conversa difícil, pergunte "como você está vendo isso?" antes de dar sua opinião.' },
    EXE: { nome: 'Execução e iniciativa', acao: 'Escolha uma tarefa parada há semanas e dê o primeiro passo concreto hoje, sem esperar o plano perfeito.' },
    EMO: { nome: 'Gestão emocional sob pressão', acao: 'Na próxima vez que sentir a tensão subir numa conversa, faça uma pausa de 10 segundos antes de responder.' },
  },
  'fit-cultural': {
    AUT: { nome: 'Autonomia', acao: 'Negocie um pedaço real de autonomia no seu trabalho atual: peça para decidir um processo pequeno sozinho.' },
    PRO: { nome: 'Disciplina de processo', acao: 'Documente por escrito um processo que hoje você faz só de memória — isso reduz risco e destrava escala.' },
    INO: { nome: 'Inovação', acao: 'Proponha esta semana uma forma diferente de resolver um problema recorrente do seu time.' },
    IMP: { nome: 'Orientação a impacto coletivo', acao: 'Escreva em uma frase o impacto real do seu trabalho em alguém — revisite isso nos dias de baixa motivação.' },
    COL: { nome: 'Colaboração', acao: 'Convide alguém de outra área para revisar uma entrega sua antes de finalizar, nesta semana.' },
    SEG: { nome: 'Busca por estabilidade', acao: 'Antes de uma decisão arriscada, escreva seu "plano B" — isso reduz o peso emocional de decidir.' },
  },
  scanner: {
    ASS: { nome: 'Assertividade', acao: 'Na próxima reunião, exponha sua posição em uma frase direta antes de justificar.' },
    EMP: { nome: 'Empatia e escuta ativa', acao: 'Numa conversa esta semana, escute 2 minutos sem interromper antes de responder.' },
    INF: { nome: 'Influência e persuasão', acao: 'Ao defender uma ideia, comece pelo "porquê" antes do "o quê" na próxima conversa importante.' },
    MED: { nome: 'Mediação de conflitos', acao: 'Na próxima divergência entre colegas, pergunte o que cada lado precisa antes de propor uma solução.' },
    NET: { nome: 'Construção de rede', acao: 'Marque uma conversa de 15 minutos com alguém fora do seu círculo direto esta semana.' },
    INT: { nome: 'Profundidade relacional', acao: 'Aprofunde uma relação já existente: faça uma pergunta pessoal genuína na próxima conversa.' },
  },
  bussola: {
    PRO: { nome: 'Propósito e missão', acao: 'Escreva uma frase sobre por que seu trabalho atual importa — revisite nos momentos de baixa motivação.' },
    IMP: { nome: 'Orientação a impacto', acao: 'Identifique 1 resultado concreto que seu trabalho gerou neste mês e anote — torna o impacto visível.' },
    SEG: { nome: 'Segurança e estabilidade', acao: 'Antes de uma escolha de carreira, liste o que precisaria ser verdade pra você se sentir seguro com ela.' },
    CRI: { nome: 'Criatividade e expressão', acao: 'Reserve 30 minutos esta semana para um projeto criativo seu, sem compromisso de resultado.' },
    REC: { nome: 'Busca por reconhecimento', acao: 'Compartilhe um resultado seu com alguém que você respeita e peça um feedback direto.' },
    AUT: { nome: 'Autonomia de carreira', acao: 'Mapeie uma decisão de carreira que você tem terceirizado para outra pessoa — e retome o controle dela.' },
  },
};

const TEMAS = {
  arquetipo: 'como você toma decisões em cenários reais',
  'fit-cultural': 'em que tipo de ambiente você performa melhor',
  scanner: 'como você se comporta em situações de relacionamento e conflito',
  bussola: 'o que move suas escolhas de carreira',
};

function round1(n) { return Math.round(Number(n || 0) * 10) / 10; }

// Ordena as dimensões da pessoa por pontuação e devolve [top, bottom].
function topBottom(scores, dimKeys) {
  const entries = dimKeys.map(k => [k, Number(scores[k] || 0)]).sort((a, b) => b[1] - a[1]);
  return { top: entries[0], bottom: entries[entries.length - 1] };
}

// Gerador determinístico (sem custo, sem chave) — usado como padrão e como
// rede de segurança se a chamada à IA falhar. Produz os 11 blocos do relatório
// de coaching a partir das competências top/bottom observadas no teste.
function gerarMock(jornada, archName, scores, dimNames) {
  const map = COMPETENCIAS[jornada] || COMPETENCIAS.arquetipo;
  const dimKeys = Object.keys(dimNames || map);
  const { top, bottom } = topBottom(scores, dimKeys);
  const compTop = map[top[0]] || { nome: dimNames[top[0]] || top[0], acao: 'Reconheça essa força e use-a deliberadamente na próxima situação real onde ela fizer diferença.' };
  const compBottom = map[bottom[0]] || { nome: dimNames[bottom[0]] || bottom[0], acao: 'Escolha uma situação real esta semana para treinar esse ponto, mesmo fora da zona de conforto.' };
  const tema = TEMAS[jornada] || 'seu comportamento real';
  const forteNome = compTop.nome.toLowerCase();
  const opNome = compBottom.nome.toLowerCase();

  return {
    resumo_executivo: `Nas situações do teste, você tende a recorrer a ${forteNome} como resposta mais consistente${archName ? `, em linha com o seu perfil de ${archName}` : ''}. ${compBottom.nome} aparece como a dimensão menos acionada — não é um defeito, é onde há mais espaço pra crescer agora.`,
    padroes_decisao: `Nos cenários de decisão do teste, você tende a priorizar ${forteNome} antes de outras dimensões. Isso sugere um padrão repetido (não pontual) de como você reduz incerteza antes de agir.`,
    estilo_relacionamento: `Em situações que envolviam outras pessoas, suas respostas tendem a refletir ${forteNome === opNome ? 'um equilíbrio entre suas dimensões' : `mais ${forteNome} do que ${opNome}`} — o que molda como colegas e times tendem a te perceber no dia a dia.`,
    ponto_forte: `${compTop.nome} é a competência que mais aparece de forma consistente nas suas respostas. Vale usá-la deliberadamente em situações de maior peso, em vez de deixá-la só "acontecer".`,
    ponto_cego: `${compBottom.nome} tende a passar mais desapercebido nas suas decisões. Pessoas com esse padrão costumam só notar esse ponto quando alguém de fora aponta — vale pedir feedback direto sobre isso.`,
    riscos_comportamentais: `Levado ao extremo, depender só de ${forteNome} pode gerar desgaste em cenários que pedem exatamente o oposto: ${opNome}. Fique atento a contextos onde isso se repete.`,
    sugestao_carreira: `Funções e contextos que valorizam ${forteNome} tendem a aproveitar melhor o seu padrão atual. Isso não é uma indicação fixa de cargo — é um critério a mais pra você avaliar oportunidades, considerando que ${tema}.`,
    plano_7_dias: compBottom.acao,
    plano_30_dias: `Ao longo do mês, busque 3 situações reais (não simuladas) para praticar ${opNome} de forma intencional, e registre o que mudou na sua forma de agir depois de cada uma.`,
    perguntas_coaching: [
      `Em que situação recente ${forteNome} te ajudou — e em qual ela te limitou?`,
      `Que situação você evita hoje porque ela exige ${opNome}?`,
      `Se alguém de confiança descrevesse seu jeito de agir em uma frase, o que diria — e isso bate com o que você vê em si mesmo?`,
    ],
    recomendacoes_conversa: `Ao conversar com seu mentor, líder ou RH, vale levar este ponto: você tende a se apoiar em ${forteNome} e tem espaço pra desenvolver ${opNome}. Pergunte que oportunidades reais existem pra praticar isso no seu contexto atual.`,
    gerado_por: 'modelo',
  };
}

// Chamada real à API da OpenAI (Chat Completions). Só é usada quando
// OPENAI_API_KEY está configurada no ambiente; caso contrário ou em caso de
// erro, cai no gerador determinístico acima — nunca quebra o relatório.
async function gerarComOpenAI(jornada, archName, scores, dimNames) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const map = COMPETENCIAS[jornada] || COMPETENCIAS.arquetipo;
  const dimKeys = Object.keys(dimNames || map);
  const linhas = dimKeys.map(k => `- ${(map[k] && map[k].nome) || dimNames[k] || k}: ${round1(scores[k])}`).join('\n');

  const system = 'Você é um coach de carreira e comportamento. Você recebe pontuações de um teste de ' +
    'comportamento em cenários reais — ele NÃO é um teste psicológico e NÃO emite diagnóstico clínico — e devolve ' +
    'um relatório de coaching estruturado em 11 blocos. Regras de linguagem, sem exceção: use sempre formas como ' +
    '"você tende a", "nas situações do teste, você...", "isso sugere", "esse padrão indica" — NUNCA "você é", ' +
    'NUNCA rótulos fixos ou afirmações absolutas sobre a pessoa. Cada bloco deve se basear nas pontuações recebidas, ' +
    'nunca generalidades vagas. Tom: direto, prático, respeitoso, sem jargão clínico. ' +
    'Responda SEMPRE em português do Brasil e em JSON puro, sem markdown, com exatamente estas chaves: ' +
    '"resumo_executivo" (2-3 frases, visão geral do padrão observado), ' +
    '"padroes_decisao" (1-2 frases sobre como a pessoa tende a decidir), ' +
    '"estilo_relacionamento" (1-2 frases sobre como tende a se comportar com outras pessoas), ' +
    '"ponto_forte" (1-2 frases sobre a competência mais consistente, com base nas pontuações mais altas), ' +
    '"ponto_cego" (1-2 frases sobre o que tende a passar desapercebido, com base nas pontuações mais baixas), ' +
    '"riscos_comportamentais" (1-2 frases sobre o risco de depender demais do ponto forte), ' +
    '"sugestao_carreira" (1-2 frases, sugestão não-prescritiva de contexto/carreira que aproveita o padrão), ' +
    '"plano_7_dias" (1 frase, ação concreta aplicável nos próximos 7 dias), ' +
    '"plano_30_dias" (1-2 frases, prática recorrente ao longo de 30 dias), ' +
    '"perguntas_coaching" (array com exatamente 3 strings, perguntas reflexivas em primeira pessoa), ' +
    '"recomendacoes_conversa" (1-2 frases com o que levar para uma conversa com mentor, líder ou RH).';

  const user = `Jornada: ${jornada} (tema: ${TEMAS[jornada] || 'comportamento em cenários reais'})\n` +
    `Perfil predominante: ${archName || 'não identificado'}\n` +
    `Pontuação por dimensão:\n${linhas}`;

  const CAMPOS_TEXTO = [
    'resumo_executivo', 'padroes_decisao', 'estilo_relacionamento', 'ponto_forte', 'ponto_cego',
    'riscos_comportamentais', 'sugestao_carreira', 'plano_7_dias', 'plano_30_dias', 'recomendacoes_conversa',
  ];

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) { console.error('ai-diagnostico: OpenAI respondeu', r.status); return null; }
    const data = await r.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    for (const campo of CAMPOS_TEXTO) { if (!parsed[campo]) return null; }
    if (!Array.isArray(parsed.perguntas_coaching) || parsed.perguntas_coaching.length < 1) return null;

    const out = { gerado_por: 'ia' };
    for (const campo of CAMPOS_TEXTO) out[campo] = String(parsed[campo]).slice(0, 600);
    out.perguntas_coaching = parsed.perguntas_coaching.slice(0, 3).map(p => String(p).slice(0, 220));
    return out;
  } catch (e) {
    console.error('ai-diagnostico: falha ao chamar OpenAI —', e.message);
    return null;
  }
}

// Ponto de entrada único: tenta IA real, cai no mock automaticamente.
async function gerarDiagnostico({ jornada, archName, scores, dimNames }) {
  const viaIA = await gerarComOpenAI(jornada, archName, scores, dimNames);
  if (viaIA) return viaIA;
  return gerarMock(jornada, archName, scores, dimNames);
}

module.exports = { gerarDiagnostico, COMPETENCIAS, TEMAS };
