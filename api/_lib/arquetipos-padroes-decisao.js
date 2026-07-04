// Conteúdo profundo dos 6 arquétipos da jornada "Padrões de Decisão" (arquetipo).
// Alimenta o relatório-retrato premium (front + geração de IA). O texto usa
// {nome} como marcador para o primeiro nome da pessoa (substituído em runtime).
//
// Dimensões da jornada:
//   SIS Organização e planejamento · AMB Tolerância à ambiguidade
//   VEL Velocidade de decisão      · REL Colaboração e empatia
//   EXE Execução e iniciativa      · EMO Gestão emocional sob pressão
//
// Cada arquétipo é definido pelo par de dimensões mais altas (dims). O texto é
// linguagem de tendência ("você tende a"), nunca rótulo clínico.

const DIM_NOMES = {
  SIS: 'Organização e planejamento',
  AMB: 'Tolerância à ambiguidade',
  VEL: 'Velocidade de decisão',
  REL: 'Colaboração e empatia',
  EXE: 'Execução e iniciativa',
  EMO: 'Gestão emocional sob pressão',
};

const ARQUETIPOS = {

  // ───────────────────────────────────────────── O ARQUITETO
  arquiteto: {
    id: 'arquiteto', name: 'O Arquiteto', icon: '🏗️',
    essence: 'Cria ordem no meio do caos.',
    dims: ['SIS', 'AMB'], baixas: ['REL', 'VEL'], raridade: 9,
    retrato: '{nome}, a sua forma de decidir tem uma assinatura nítida: você junta duas coisas raras — gosta de organizar e não se assusta com o incerto. Onde a maioria vê bagunça, você já começa a desenhar um caminho. Isso aparece tanto num projeto de trabalho quanto quando a vida embaralha e alguém precisa dar o primeiro passo.',
    assinatura: 'Onde os outros veem bagunça, você enxerga um rascunho esperando ordem.',
    porque: 'O arquétipo não vem de um traço isolado, mas do encontro dos seus dois picos: organização alta somada a tolerância à ambiguidade alta. Separadas, são comuns. Juntas, são incomuns — a maioria de quem gosta de estrutura evita o incerto, e a maioria que abraça o incerto resiste à estrutura. Você faz as duas ao mesmo tempo.',
    dia_a_dia: 'Num projeto sem escopo, você é quem propõe as primeiras divisões e nomeia as etapas. Numa mudança de vida, é quem monta o cronograma e o "por onde começar". As pessoas passam a te procurar exatamente nos momentos de indefinição — e isso reforça o padrão, porque funciona.',
    tensao: 'A mesma organização que te dá clareza pode virar pedágio: você quer estruturar tanto que a ação espera. E como tolera bem a ambiguidade, raramente sente urgência de fechar — o que tende a adiar movimentos que já poderiam acontecer.',
    forcas: [
      { t: 'Transformar confusão em clareza', d: 'Ofereça-se para os inícios ambíguos — é onde você rende acima da média.' },
      { t: 'Dar o primeiro rascunho', d: 'Sua estrutura destrava o grupo; entregue-a cedo, mesmo imperfeita.' },
      { t: 'Sustentar direção no incerto', d: 'Em projetos longos e nebulosos, você mantém o norte quando outros se perdem.' },
    ],
    riscos: [
      { t: 'Superplanejamento', d: 'Estruturar vira desculpa para não começar.' },
      { t: 'Decisão adiada', d: 'Buscar "mais um dado" quando 80% já bastava.' },
      { t: 'Resolver sozinho', d: 'Fechar o plano antes de ouvir quem será afetado por ele.' },
    ],
    sinais_alerta: [
      'Você tem três versões de um plano, mas nada foi entregue ainda.',
      'Alguém disse "já dava pra começar" e você respondeu "só falta ajustar uma coisa".',
      'Uma decisão pequena está há dias na sua cabeça esperando "o momento certo".',
      'Um colega foi pego de surpresa por um plano que você já tinha fechado sozinho.',
    ],
    percepcao: 'Confiável e claro nos momentos de indefinição — a pessoa que "organiza a casa". O reverso: às vezes distante nas decisões, porque você pensa por dentro e aparece com a resposta pronta. Trazer as pessoas antes do plano fechado muda essa percepção rápido.',
    carreira: {
      favorecem: ['Começos: novos projetos, produtos, áreas sendo montadas.', 'Problemas amplos sem manual: estratégia, planejamento, pesquisa.', 'Papéis que valorizam desenhar processo e trazer ordem.', 'Empreender ou liderar iniciativas do zero.'],
      drenam: ['Operações 100% roteirizadas, sem espaço para redesenhar.', 'Ambientes que exigem decisão instantânea o tempo todo.', 'Funções de execução repetitiva e alto volume.', 'Culturas onde "pensar antes" é lido como lentidão.'],
      familias: 'Gestão de projetos e programas, estratégia e operações, design de processos, pesquisa e planejamento, e papéis de fundação em times novos.',
    },
    plano: {
      d7: { h: 'Entregue uma versão "boa o suficiente"', p: 'Escolha uma ideia parada à espera do plano perfeito e coloque um prazo curto para tirá-la do papel, mesmo incompleta.', obs: 'Observe o que aconteceu de ruim por começar com 80% — quase sempre, menos do que a cabeça previa.' },
      d30: { h: 'Treine três decisões rápidas de baixo risco', p: 'Em escolhas pequenas, imponha um limite de 10 minutos e decida. Reserve o seu rigor para o que de fato tem peso.', obs: 'Registre cada uma e o resultado — você vai construir evidência de que decidir rápido raramente sai caro.' },
      d90: { h: 'Traga uma pessoa para dentro do plano antes de fechá-lo', p: 'Em cada iniciativa relevante, convide quem será afetado enquanto o rascunho ainda está aberto. Pergunte "como você está vendo isso?" antes de apresentar a solução.', obs: 'Observe a mudança na adesão do grupo — e na forma como te percebem nas decisões.' },
    },
    perguntas: [
      'Qual ideia sua está esperando "o plano perfeito" para começar — e o que dá para testar já esta semana?',
      'Em que momento recente organizar te ajudou — e em qual isso te fez perder o tempo da ação?',
      'Se alguém de confiança descrevesse o seu jeito de decidir em uma frase, o que diria?',
    ],
    conversa: { apoio: 'organização e leitura do incerto', desenvolvendo: 'velocidade de decisão e envolver pessoas mais cedo' },
  },

  // ───────────────────────────────────────────── O REALIZADOR
  executor: {
    id: 'executor', name: 'O Realizador', icon: '🔩',
    essence: 'Põe a mão na massa e entrega.',
    dims: ['EXE', 'VEL'], baixas: ['SIS', 'EMO'], raridade: 21,
    retrato: '{nome}, você não trava: decide, faz e ajusta no caminho. Diante dos cenários do teste, a sua resposta mais consistente foi o movimento — enquanto muitos ponderam, você já deu o primeiro passo. Essa energia de tirar as coisas do papel é o seu motor, e faz quem está por perto se mover mais rápido também.',
    assinatura: 'Você transforma intenção em resultado antes de a maioria terminar de planejar.',
    porque: 'O seu perfil nasce do encontro de execução alta com velocidade alta: você não só quer fazer, você decide rápido para poder fazer logo. É uma combinação de ação — poderosa para destravar, e que cobra atenção justamente onde a pausa importa: planejamento e leitura emocional da situação.',
    dia_a_dia: 'Quando algo empaca, você é quem diz "vamos começar por aqui" e puxa. Prazos apertados, imprevistos, perrengues operacionais — é onde você acelera enquanto outros hesitam. As pessoas contam com você para tirar do abstrato e colocar na prática.',
    tensao: 'A mesma pressa que entrega pode gerar retrabalho. Correr custa caro quando a decisão era irreversível ou dependia de gente que não foi ouvida. Sob pressão, a tendência é agir para aliviar a tensão — nem sempre é a melhor hora de decidir.',
    forcas: [
      { t: 'Fazer acontecer', d: 'Assuma os gargalos parados — você os destrava mais rápido que a média.' },
      { t: 'Decidir sob incerteza', d: 'Onde falta clareza e sobra urgência, a sua ação evita a paralisia do grupo.' },
      { t: 'Dar ritmo', d: 'Sua energia contamina; use-a para puxar times lentos, com intenção.' },
    ],
    riscos: [
      { t: 'Retrabalho por pressa', d: 'Começar antes de entender o suficiente custa refazer.' },
      { t: 'Atropelar pessoas', d: 'Decidir sozinho e rápido deixa quem depende da decisão para trás.' },
      { t: 'Confundir movimento com progresso', d: 'Estar ocupado nem sempre é estar avançando no que importa.' },
    ],
    sinais_alerta: [
      'Você já refez algo esta semana que teria evitado com 10 minutos de pausa.',
      'Uma decisão grande foi tomada "no impulso" e ainda está te cobrando.',
      'Alguém do time disse que foi pego de surpresa por uma escolha sua.',
      'Você sente desconforto em ficar parado, mesmo quando parar era o certo.',
    ],
    percepcao: 'Enérgico e confiável para entregar — a pessoa que "faz o negócio andar". O reverso: às vezes atropelado, decidindo antes de alinhar. Uma pausa curta antes das decisões de maior peso muda como te percebem, sem tirar a sua velocidade.',
    carreira: {
      favorecem: ['Ritmo rápido e metas claras: vendas, operações, atendimento.', 'Ambientes onde entregar vale mais que deliberar.', 'Empreender e tocar iniciativas com autonomia.', 'Contextos de crise ou virada, que pedem ação imediata.'],
      drenam: ['Processos longos de aprovação e deliberação.', 'Funções que exigem análise minuciosa antes de qualquer passo.', 'Ambientes muito políticos, onde mover rápido gera atrito.', 'Trabalho sem metas visíveis nem senso de progresso.'],
      familias: 'Vendas e operações, atendimento e suporte, gestão de times de campo, empreendedorismo e qualquer papel de "dono do resultado".',
    },
    plano: {
      d7: { h: 'Insira uma pausa de uma noite antes de decisões grandes', p: 'Escreva as opções e a pergunta "qual o custo de errar aqui?". Só decida no dia seguinte.', obs: 'Observe quantas decisões mudaram de rumo com uma noite de distância.' },
      d30: { h: 'Antes de começar, gaste 10 minutos mapeando', p: 'Em tarefas de médio porte, liste o essencial e os riscos antes do primeiro passo. Só isso reduz retrabalho.', obs: 'Compare o retrabalho das tarefas com e sem esses 10 minutos.' },
      d90: { h: 'Alinhe antes de acelerar', p: 'Nas decisões que afetam outros, avise e ouça quem será impactado antes de puxar a ação.', obs: 'Observe a queda no atrito e no "fui pego de surpresa".' },
    },
    perguntas: [
      'Onde a sua pressa já te custou caro — e como você perceberia, na próxima vez, que vale desacelerar?',
      'Qual decisão recente teria sido melhor com uma noite de distância?',
      'Quem costuma ser pego de surpresa pelas suas escolhas — e o que mudaria se você o avisasse antes?',
    ],
    conversa: { apoio: 'execução e velocidade para entregar', desenvolvendo: 'planejar o essencial antes de agir e alinhar com quem é afetado' },
  },

  // ───────────────────────────────────────────── O CONECTOR
  conector: {
    id: 'conector', name: 'O Conector', icon: '🔗',
    essence: 'Decide pensando nas pessoas.',
    dims: ['REL', 'EMO'], baixas: ['VEL', 'SIS'], raridade: 17,
    retrato: '{nome}, você lê o ambiente pelas pessoas: percebe como estão se sentindo, o que não foi dito, quem precisa de apoio. Nos cenários do teste, as suas escolhas passaram, repetidamente, pelo impacto humano da decisão. Essa sensibilidade é rara e muda o clima de qualquer grupo por onde você passa.',
    assinatura: 'Você sente a temperatura de uma sala antes de qualquer um dizer uma palavra.',
    porque: 'O seu perfil vem de colaboração alta somada a boa gestão emocional: você não só se importa com as pessoas, você mantém a calma para cuidar delas quando a tensão sobe. É a base de quem une grupos — e o cuidado, levado ao extremo, também é a raiz do seu principal risco.',
    dia_a_dia: 'Quando há atrito, você é quem aproxima as partes e traduz um lado para o outro. Em times, você percebe quem está sobrecarregado antes de a pessoa pedir ajuda. As pessoas confiam em você com o que não contam para os outros.',
    tensao: 'Cuidar tanto dos outros pode fazer você se esquecer de si — e adiar conversas difíceis para não magoar ninguém. Evitar o conflito hoje costuma criar um maior amanhã, e a conta emocional acaba sobrando para você.',
    forcas: [
      { t: 'Criar confiança', d: 'Você abre canais que ninguém mais abre; use isso para destravar conversas travadas.' },
      { t: 'Ler o não dito', d: 'Perceber o clima antecipa problemas — leve o que você sente para a mesa, não só para dentro.' },
      { t: 'Acalmar tensões', d: 'Em conflitos, a sua presença regula o grupo; posicione-se como ponte, não como para-choque.' },
    ],
    riscos: [
      { t: 'Autoapagamento', d: 'Cuidar de todos e esquecer das próprias necessidades.' },
      { t: 'Evitar conflito', d: 'Adiar a conversa difícil para não desagradar, deixando o problema crescer.' },
      { t: 'Absorver o peso alheio', d: 'Carregar a emoção do grupo até esgotar.' },
    ],
    sinais_alerta: [
      'Há uma conversa importante que você vem adiando "para não magoar".',
      'Você terminou a semana exausto de resolver o de todo mundo, menos o seu.',
      'Você concordou com algo que não queria só para evitar tensão.',
      'Alguém abusa da sua disponibilidade e você ainda não disse nada.',
    ],
    percepcao: 'Acolhedor e confiável — a pessoa com quem todos desabafam. O reverso: às vezes evasivo nas horas duras, porque prioriza a harmonia. Dizer o que você precisa, com clareza e gentileza, aumenta o seu peso sem custar o afeto que você já construiu.',
    carreira: {
      favorecem: ['Tudo que envolve gente: cuidado, ensino, atendimento, saúde.', 'Liderança de pessoas e desenvolvimento de times.', 'Recursos humanos, comunidades, causas e relações.', 'Papéis de ponte entre áreas ou entre a empresa e o cliente.'],
      drenam: ['Ambientes frios, transacionais, sem vínculo humano.', 'Funções de confronto constante ou negociação dura e impessoal.', 'Culturas que tratam cuidado como fraqueza.', 'Trabalho isolado, sem contato com pessoas.'],
      familias: 'Gestão de pessoas e liderança, RH e desenvolvimento, educação e saúde, atendimento e sucesso do cliente, e papéis de articulação entre times.',
    },
    plano: {
      d7: { h: 'Tenha uma conversa que você vem adiando', p: 'Escolha a mais leve da lista e diga o que precisa, com clareza e gentileza. Comece pequeno.', obs: 'Observe: a relação piorou de verdade, ou aliviou uma tensão que só existia na sua cabeça?' },
      d30: { h: 'Diga "não" uma vez por semana', p: 'Recuse um pedido que você aceitaria só por evitar o desconforto. Devolva o tempo para você.', obs: 'Registre como a outra pessoa reagiu — quase sempre melhor do que o medo previa.' },
      d90: { h: 'Leve a sua leitura para a mesa', p: 'Quando sentir o clima, nomeie: "percebo que há uma tensão aqui". Transforme sensibilidade em contribuição visível.', obs: 'Observe o quanto isso antecipa problemas e aumenta o seu peso nas decisões.' },
    },
    perguntas: [
      'Qual conversa importante você está adiando para não desagradar — e o que mudaria se você a tivesse?',
      'Onde você tem dito "sim" quando queria dizer "não"?',
      'Se você cuidasse de si com o mesmo zelo que cuida dos outros, o que faria diferente esta semana?',
    ],
    conversa: { apoio: 'empatia, leitura do grupo e construção de confiança', desenvolvendo: 'assertividade e não adiar conversas difíceis' },
  },

  // ───────────────────────────────────────────── O ANALISTA
  analista: {
    id: 'analista', name: 'O Analista', icon: '📐',
    essence: 'Pensa com método e capricho.',
    dims: ['SIS', 'EXE'], baixas: ['VEL', 'AMB'], raridade: 19,
    retrato: '{nome}, você pensa antes de agir e age com cuidado. Nos cenários do teste, a sua marca foi a consistência: escolhas que buscam fazer bem feito, sem deixar pontas soltas. As pessoas confiam em você exatamente por isso — quando é você, a qualidade vem junto.',
    assinatura: 'Quando algo passa pela sua mão, raramente volta com defeito.',
    porque: 'O seu perfil combina organização alta com execução alta: você não só planeja, você conclui — e conclui com padrão. Essa é a base da confiabilidade. O ponto de atenção mora onde a régua da qualidade encontra o relógio: velocidade e tolerância ao "suficiente".',
    dia_a_dia: 'Você é quem revisa, quem percebe o detalhe que passaria batido, quem entrega no prazo sem sacrificar o acabamento. Em tarefas onde errar tem custo, o time respira aliviado quando é você que assume.',
    tensao: 'Buscar o perfeito pode te deixar lento — ou exigente demais, com você e com os outros. Nem toda tarefa merece 100%, e insistir onde 80% bastava transforma capricho em gargalo.',
    forcas: [
      { t: 'Confiabilidade', d: 'Assuma o que não pode falhar — é onde a sua consistência vale mais.' },
      { t: 'Olho para o detalhe', d: 'Você pega o que os outros deixam passar; use isso onde o erro é caro, não em tudo.' },
      { t: 'Padrão elevado', d: 'A sua régua puxa a qualidade do grupo para cima quando você a torna explícita.' },
    ],
    riscos: [
      { t: 'Perfeccionismo', d: 'Buscar o impecável onde o suficiente resolvia.' },
      { t: 'Lentidão por rigor', d: 'Caprichar demais vira travar demais.' },
      { t: 'Exigência com os outros', d: 'Cobrar dos outros a sua régua interna gera atrito.' },
    ],
    sinais_alerta: [
      'Você segurou uma entrega pronta "para melhorar mais um pouco".',
      'Um detalhe que ninguém notaria consumiu horas do seu dia.',
      'Alguém do time evitou te mostrar algo por medo da sua crítica.',
      'Você recusou uma tarefa boa por não conseguir fazê-la "perfeita" no prazo.',
    ],
    percepcao: 'Sólido e caprichoso — a pessoa que entrega com qualidade. O reverso: às vezes lento ou exigente demais. Definir, para cada tarefa, o nível de capricho que ela realmente pede te faz mais rápido sem perder a confiança que a sua régua construiu.',
    carreira: {
      favorecem: ['Onde qualidade importa mais que pressa: finanças, dados, jurídico.', 'Engenharia, saúde, qualidade e ofícios técnicos.', 'Planejamento e controle, auditoria, conformidade.', 'Funções onde consistência é o diferencial.'],
      drenam: ['Ambientes de "publica e conserta depois", tolerantes a erro.', 'Ritmo frenético que penaliza o cuidado.', 'Trabalho vago, sem critério claro de "pronto".', 'Mudança constante que impede aprofundar.'],
      familias: 'Finanças e dados, jurídico e conformidade, engenharia e qualidade, saúde e planejamento — áreas onde o rigor é o produto.',
    },
    plano: {
      d7: { h: 'Entregue uma tarefa em 80%', p: 'Escolha algo de baixo risco, defina o "suficiente" antes de começar e entregue nesse ponto. Não melhore depois.', obs: 'Observe se alguém sequer notou a diferença — e quanto tempo você ganhou.' },
      d30: { h: 'Classifique o capricho por tarefa', p: 'Para cada demanda, decida: isto pede 100%, 80% ou 60%? Guarde o impecável para o que realmente importa.', obs: 'Registre onde o 100% era desnecessário — costuma ser a maioria.' },
      d90: { h: 'Decida com 80% da informação', p: 'Em decisões sem volta cara, avance sem o dado que falta. Treine a tolerância ao incerto que hoje é o seu ponto mais baixo.', obs: 'Observe quantas dessas decisões deram certo mesmo sem a certeza total.' },
    },
    perguntas: [
      'Onde o seu "caprichar mais" virou "travar mais" — e o que aconteceria se você entregasse antes?',
      'Qual tarefa recente não merecia os 100% que você deu?',
      'Onde a sua régua interna está cobrando dos outros algo que eles não precisam entregar?',
    ],
    conversa: { apoio: 'rigor, confiabilidade e olhar para o detalhe', desenvolvendo: 'velocidade e tolerância ao "bom o suficiente"' },
  },

  // ───────────────────────────────────────────── O NAVEGADOR
  estrategista: {
    id: 'estrategista', name: 'O Navegador', icon: '🧭',
    essence: 'Ágil em terreno incerto.',
    dims: ['AMB', 'VEL'], baixas: ['SIS', 'EMO'], raridade: 13,
    retrato: '{nome}, você se move bem quando o mapa não existe. Nos cenários do teste, você não esperou tudo ficar claro: leu os sinais, testou, ajustou e seguiu. Em situações novas ou que mudam o tempo todo, você acha caminho onde os outros veem beco.',
    assinatura: 'Você encontra a saída enquanto os outros ainda procuram o mapa.',
    porque: 'O seu perfil une tolerância à ambiguidade alta com velocidade alta: o incerto não te paralisa e você decide rápido para continuar em movimento. É a combinação do explorador — excelente para terreno novo, e que cobra atenção onde o caminho pede o oposto: persistência e estrutura.',
    dia_a_dia: 'Quando o plano muda no meio, você é quem já está pensando no próximo. Contextos ambíguos, pivôs, novidades sem precedente — é ali que você acelera enquanto outros travam. Você abre trilhas; a régua não é conforto, é adaptação.',
    tensao: 'Tanta adaptabilidade pode virar falta de profundidade. Algumas coisas pedem persistência, não mais um plano novo — e a vontade de mudar de rota pode fazer você largar o que só daria certo se continuasse.',
    forcas: [
      { t: 'Avançar no incerto', d: 'Assuma os territórios sem mapa — a sua vantagem é justamente onde falta clareza.' },
      { t: 'Adaptar rápido', d: 'Quando o cenário vira, você recalcula sem drama; seja o estabilizador da mudança.' },
      { t: 'Enxergar saídas', d: 'A sua criatividade acha rota onde outros veem parede — traga isso para os impasses do time.' },
    ],
    riscos: [
      { t: 'Falta de profundidade', d: 'Trocar de rota antes de colher o que a atual daria.' },
      { t: 'Não terminar', d: 'Começar muitas coisas e concluir poucas.' },
      { t: 'Dispersão', d: 'A novidade seduz e rouba foco do que exige persistência.' },
    ],
    sinais_alerta: [
      'Você tem várias coisas começadas e poucas terminadas.',
      'Bateu tédio num projeto e a vontade foi "começar outro".',
      'Algo que você largou deu certo depois — na mão de quem persistiu.',
      'Você confunde "mudar de estratégia" com "fugir da parte chata".',
    ],
    percepcao: 'Versátil e criativo — a pessoa que não trava no imprevisto. O reverso: às vezes disperso, sem levar as coisas até o fim. Escolher uma ou duas apostas para concluir, mesmo quando der vontade de trocar, transforma agilidade em resultado que fica.',
    carreira: {
      favorecem: ['Mudança e novidade: empreender, inovação, novos produtos.', 'Projetos exploratórios sem precedente na empresa.', 'Vendas e criação em mercados que se transformam rápido.', 'Ambientes de incerteza alta, que penalizam a paralisia.'],
      drenam: ['Rotinas fixas e repetitivas, sem espaço para variar.', 'Processos longos que exigem persistência sem novidade.', 'Funções de manutenção do que já funciona.', 'Culturas rígidas, avessas a testar o novo.'],
      familias: 'Empreendedorismo e inovação, desenvolvimento de novos produtos, vendas e expansão, criação e estratégia em contextos de mudança.',
    },
    plano: {
      d7: { h: 'Escolha uma coisa para terminar', p: 'Pegue algo começado e leve até o fim antes de iniciar qualquer novidade nesta semana.', obs: 'Observe a satisfação de concluir — costuma ser subestimada por quem ama começar.' },
      d30: { h: 'Segure o impulso de trocar de rota', p: 'Quando bater vontade de mudar de estratégia, espere 48h antes de decidir. Separe tédio de razão real.', obs: 'Registre quantas vontades de trocar eram fuga da parte difícil.' },
      d90: { h: 'Vá fundo em uma aposta', p: 'Escolha uma iniciativa e comprometa-se a persistir por 90 dias, mesmo sem a novidade. Profundidade é o seu treino.', obs: 'Observe o que só apareceu porque você ficou — resultados que a troca constante escondia.' },
    },
    perguntas: [
      'O que você começou e não terminou — e qual dessas coisas merece a sua persistência agora?',
      'Quando a vontade de mudar de rota foi razão de verdade, e quando foi fuga do tédio?',
      'Onde ficar mais tempo teria mudado o resultado?',
    ],
    conversa: { apoio: 'adaptabilidade e agilidade no incerto', desenvolvendo: 'persistência e profundidade em uma aposta de cada vez' },
  },

  // ───────────────────────────────────────────── O GUARDIÃO
  guardiao: {
    id: 'guardiao', name: 'O Guardião', icon: '🛡️',
    essence: 'Cuida das pessoas com organização.',
    dims: ['REL', 'SIS'], baixas: ['VEL', 'AMB'], raridade: 11,
    retrato: '{nome}, você junta cuidado com as pessoas e senso de organização. Nos cenários do teste, as suas escolhas criaram, repetidamente, ambientes onde os outros se sentem seguros e sabem o que esperar. É a pessoa em quem todos confiam — porque você é justo, presente e constante.',
    assinatura: 'Você é a base sólida onde as pessoas sabem que podem se apoiar.',
    porque: 'O seu perfil une colaboração alta com organização alta: você cuida das pessoas e da estrutura ao mesmo tempo. É a combinação de quem constrói estabilidade — rara e valiosa. O ponto de atenção surge quando cuidar e organizar entram em conflito com a decisão dura que precisa ser tomada.',
    dia_a_dia: 'Você é quem cria a rotina que acolhe, o processo justo, o ambiente previsível onde ninguém fica para trás. Em times, você garante que as combinações sejam claras e que as pessoas sejam tratadas com equidade.',
    tensao: 'Decisões difíceis que afetam pessoas podem ser adiadas demais. Proteger todo mundo às vezes trava o necessário — e cuidar de verdade, em certos momentos, é ter a coragem de ser honesto a tempo.',
    forcas: [
      { t: 'Construir confiança que dura', d: 'Você cria estabilidade; seja o alicerce em times que estão instáveis.' },
      { t: 'Justiça e constância', d: 'A sua equidade sustenta a moral do grupo — torne os critérios visíveis.' },
      { t: 'Cuidar de gente e processo', d: 'Você equilibra os dois; use isso onde falta base sólida.' },
    ],
    riscos: [
      { t: 'Adiar a decisão dura', d: 'Proteger pessoas a ponto de travar o que precisa acontecer.' },
      { t: 'Excesso de proteção', d: 'Poupar alguém de um feedback que o faria crescer.' },
      { t: 'Rigidez em nome da segurança', d: 'Segurar o previsível quando a situação já pede mudança.' },
    ],
    sinais_alerta: [
      'Há uma decisão justa que você vem adiando para evitar desconforto.',
      'Você poupou alguém de um feedback difícil — e o problema cresceu.',
      'Uma mudança necessária travou porque "ia mexer com as pessoas".',
      'Você prioriza a paz do grupo mesmo quando ela custa o resultado.',
    ],
    percepcao: 'Confiável e justo — a pessoa que dá base ao time. O reverso: às vezes lento nas decisões duras, por proteger demais. Tomar a decisão difícil quando ela é justa, mesmo desconfortável, mostra que cuidar também é ser honesto a tempo — e aumenta o respeito que você já tem.',
    carreira: {
      favorecem: ['Cuidar de pessoas e processos ao mesmo tempo: liderança, gestão.', 'Educação, saúde e times que precisam de base sólida.', 'Operações de pessoas, cultura e desenvolvimento.', 'Papéis de estabilidade em ambientes que cresceram rápido.'],
      drenam: ['Ambientes de confronto constante e alta rotatividade.', 'Culturas de "cada um por si", sem espaço para cuidado.', 'Funções que exigem decidir rápido e sozinho, sem apoio.', 'Caos permanente, sem previsibilidade possível.'],
      familias: 'Liderança de pessoas, gestão de operações e cultura, educação e saúde, RH e desenvolvimento — onde base sólida e equidade são o valor.',
    },
    plano: {
      d7: { h: 'Tome uma decisão justa que está parada', p: 'Escolha a mais leve e aja, mesmo que desconforte um pouco. Cuidar também é ser honesto a tempo.', obs: 'Observe quem, no fim, ganhou com a decisão que você vinha adiando.' },
      d30: { h: 'Dê o feedback que você vem poupando', p: 'Escolha uma pessoa e ofereça, com cuidado, a verdade que a faria crescer.', obs: 'Registre a reação — proteger da verdade raramente é o maior cuidado.' },
      d90: { h: 'Separe "proteger" de "atrasar"', p: 'Antes de segurar uma mudança pelas pessoas, pergunte se está protegendo ou apenas adiando o inevitável.', obs: 'Observe onde a decisão antecipada teria evitado um dano maior.' },
    },
    perguntas: [
      'Que decisão justa você está adiando para evitar desconforto — e quem ganharia se você a tomasse?',
      'Onde o seu cuidado virou proteção que atrasa o necessário?',
      'Qual verdade difícil, dita com carinho, ajudaria alguém a crescer?',
    ],
    conversa: { apoio: 'cuidado com pessoas e senso de organização', desenvolvendo: 'tomar decisões duras a tempo, mesmo quando desconfortam' },
  },

};

module.exports = { ARQUETIPOS, DIM_NOMES };
