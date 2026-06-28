// Núcleo do "Diagnóstico de Coaching" — conecta o resultado de cada jornada a
// competências comportamentais e gera 3 pontos (insight, oportunidade, ação
// prática), no tema único do Entre Escolhas: comportamento em cenários reais.
//
// Sem OPENAI_API_KEY configurada: usa um gerador determinístico (mock) com os
// mesmos 3 campos, então o produto funciona ponta a ponta hoje. Quando a chave
// for adicionada ao ambiente, passa a chamar a API da OpenAI automaticamente —
// nenhuma mudança de código é necessária na troca.

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
// rede de segurança se a chamada à IA falhar.
function gerarMock(jornada, archName, scores, dimNames) {
  const map = COMPETENCIAS[jornada] || COMPETENCIAS.arquetipo;
  const dimKeys = Object.keys(dimNames || map);
  const { top, bottom } = topBottom(scores, dimKeys);
  const compTop = map[top[0]] || { nome: dimNames[top[0]] || top[0], acao: 'Reconheça essa força e use-a deliberadamente na próxima situação real onde ela fizer diferença.' };
  const compBottom = map[bottom[0]] || { nome: dimNames[bottom[0]] || bottom[0], acao: 'Escolha uma situação real esta semana para treinar esse ponto, mesmo fora da zona de conforto.' };

  return {
    insight: `Olhando como você reagiu nas situações do teste, sua força mais consistente é ${compTop.nome.toLowerCase()}${archName ? ` — coerente com o seu perfil de ${archName}` : ''}. É um comportamento que aparece de forma repetida, não pontual, o que indica que já é parte do seu jeito de agir.`,
    oportunidade: `${compBottom.nome} aparece como a dimensão menos acionada nas suas respostas. Não é um defeito — é o ponto com mais espaço pra crescer, especialmente em cenários de carreira onde ${TEMAS[jornada] || 'seu comportamento real'} é o que mais pesa.`,
    acao_pratica: compBottom.acao,
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

  const system = 'Você é um especialista em coaching comportamental e de carreira. ' +
    'Você recebe pontuações de um teste de comportamento em cenários reais (não é um teste psicológico, ' +
    'não emite diagnóstico clínico) e devolve um diagnóstico curto, prático e orientado a carreira no curto prazo. ' +
    'Responda SEMPRE em português do Brasil e em JSON puro, sem markdown, com exatamente as chaves: ' +
    '"insight" (1-2 frases sobre o comportamento atual, com base nas pontuações mais altas), ' +
    '"oportunidade" (1-2 frases sobre a dimensão com mais espaço pra crescer, com base nas pontuações mais baixas), ' +
    '"acao_pratica" (1 frase, uma ação concreta e aplicável esta semana, no contexto de carreira).';

  const user = `Jornada: ${jornada} (tema: ${TEMAS[jornada] || 'comportamento em cenários reais'})\n` +
    `Perfil predominante: ${archName || 'não identificado'}\n` +
    `Pontuação por dimensão:\n${linhas}`;

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
    if (!parsed.insight || !parsed.oportunidade || !parsed.acao_pratica) return null;
    return {
      insight: String(parsed.insight).slice(0, 600),
      oportunidade: String(parsed.oportunidade).slice(0, 600),
      acao_pratica: String(parsed.acao_pratica).slice(0, 300),
      gerado_por: 'ia',
    };
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
