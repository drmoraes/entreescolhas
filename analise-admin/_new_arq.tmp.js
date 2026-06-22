  'arquetipo': {
    badge: 'Comece grátis • Relatório completo no final',
    title: 'Como você<br/><span class="grad serif">toma decisões</span>',
    desc: '20 situações da vida real — no trabalho, nos estudos, com dinheiro, com as pessoas. Cada escolha mostra como você decide, age sob pressão e reage quando tudo muda.',
    resultTag: 'Seu jeito de decidir',
    dimsTitle: 'Você em 6 traços',
    shareText: 'Descobri meu jeito de decidir no Entre Escolhas! Faça o seu: https://www.entreescolhas.com.br',
    backLink: '/',
    dimNames: {
      SIS: 'Organização e método',
      AMB: 'Lidar com o incerto',
      VEL: 'Rapidez para decidir',
      REL: 'Foco nas pessoas',
      EXE: 'Mão na massa',
      EMO: 'Equilíbrio emocional'
    },
    questions: [
      {
        context: "Um plano que mudou de repente",
        text: "Você organizou tudo para um dia importante e, na última hora, os planos viram de cabeça pra baixo. O que você faz primeiro?",
        opts: [
          { text: "Respiro, paro alguns minutos e monto um plano novo", dims: {SIS:3, EMO:2} },
          { text: "Converso com quem está junto pra decidir o caminho em conjunto", dims: {REL:3, AMB:1} },
          { text: "Vejo rápido o que dá pra salvar e já começo a agir", dims: {EXE:3, VEL:2} },
          { text: "Encaro como aventura — às vezes o improviso abre algo melhor", dims: {AMB:3, VEL:1} }
        ]
      },
      {
        context: "Uma escolha grande, com prazo curto",
        text: "Você precisa escolher entre duas oportunidades. Uma é segura e previsível; a outra tem mais potencial, mas também mais risco. Precisa decidir até amanhã.",
        opts: [
          { text: "Listo prós e contras e dou uma nota pra cada ponto", dims: {SIS:3} },
          { text: "Converso com gente que já passou por algo parecido", dims: {REL:3, EMO:1} },
          { text: "Vou no instinto — pensar demais me trava", dims: {VEL:3, EXE:1} },
          { text: "Escolho o caminho onde vou aprender mais, mesmo incerto", dims: {AMB:3} }
        ]
      },
      {
        context: "Duas pessoas próximas brigadas",
        text: "Dois amigos (ou colegas) seus estão de mal, e isso está atrapalhando todo mundo. Você acabou no meio. O que faz?",
        opts: [
          { text: "Proponho uma conversa com hora marcada e foco em resolver", dims: {SIS:2, REL:2} },
          { text: "Falo com cada um em separado antes de juntar os dois", dims: {REL:3, EMO:2} },
          { text: "Deixo o tempo esfriar e sigo com o que dá pra tocar", dims: {EXE:2, VEL:2} },
          { text: "Tento entender o lado de cada um antes de opinar", dims: {EMO:3, REL:1} }
        ]
      },
      {
        context: "Erro descoberto na última hora",
        text: "Faltando pouco para entregar algo (um trabalho, uma tarefa, um compromisso), você percebe um erro sério. Consertar vai levar tempo que você não tem.",
        opts: [
          { text: "Aviso na hora quem depende disso e proponho um novo prazo", dims: {REL:3, EMO:2} },
          { text: "Faço o que der pra corrigir e entrego, mesmo um pouco atrasado", dims: {EXE:3, VEL:1} },
          { text: "Entrego o que está pronto e sinalizo o que falta revisar", dims: {VEL:2, AMB:2} },
          { text: "Avalio o tamanho real do erro antes de qualquer reação", dims: {SIS:3} }
        ]
      },
      {
        context: "Falar uma verdade difícil",
        text: "Você precisa dizer algo desconfortável para alguém de quem gosta — um erro que afetou os dois. Como conduz?",
        opts: [
          { text: "Direto e claro: digo o que foi, o efeito e o que muda daqui pra frente", dims: {VEL:3, SIS:1} },
          { text: "Começo entendendo o lado da pessoa antes de falar", dims: {REL:3, EMO:1} },
          { text: "Preparo exemplos concretos pra conversa não virar discussão", dims: {SIS:3, EXE:1} },
          { text: "Escolho a hora certa — o momento emocional importa", dims: {EMO:3, REL:1} }
        ]
      },
      {
        context: "Começar algo do zero",
        text: "Você decide tirar um sonho do papel (um curso, um projeto, um negócio), mas não existe manual: nada está definido. Por onde começa?",
        opts: [
          { text: "Boto a mão na massa logo e vou ajustando no caminho", dims: {EXE:3, AMB:1} },
          { text: "Faço perguntas até ter clareza pra dar o primeiro passo", dims: {SIS:3, EMO:1} },
          { text: "Monto um plano e marcos antes de começar", dims: {SIS:2, EXE:2} },
          { text: "Chamo as pessoas certas — junto a gente resolve", dims: {REL:3, AMB:1} }
        ]
      },
      {
        context: "Uma grana extra inesperada",
        text: "Sobrou um dinheiro que você não esperava. O que faz?",
        opts: [
          { text: "Guardo e planejo onde ele faz mais diferença", dims: {SIS:3, EMO:1} },
          { text: "Arrisco em algo com potencial de render mais", dims: {AMB:3, VEL:1} },
          { text: "Resolvo logo algo que estava pendente", dims: {EXE:3, VEL:1} },
          { text: "Uso parte pra ajudar alguém ou celebrar com quem amo", dims: {REL:3, EMO:1} }
        ]
      },
      {
        context: "Aprender algo difícil",
        text: "Você precisa aprender uma coisa nova e puxada, do zero. Qual é o seu jeito?",
        opts: [
          { text: "Estudo com método: passo a passo, do básico ao avançado", dims: {SIS:3} },
          { text: "Aprendo fazendo — erro, corrijo e sigo", dims: {EXE:3, VEL:1} },
          { text: "Vou tateando, testo do meu jeito sem roteiro fixo", dims: {AMB:3} },
          { text: "Procuro alguém que já saiba pra me guiar", dims: {REL:3, EMO:1} }
        ]
      },
      {
        context: "Uma mudança grande na vida",
        text: "Você está diante de uma mudança e tanto (de cidade, de trabalho, de fase). Como lida com o frio na barriga?",
        opts: [
          { text: "Organizo cada etapa pra reduzir o risco", dims: {SIS:3, EMO:1} },
          { text: "Topo logo e vou descobrindo no caminho", dims: {AMB:3, VEL:2} },
          { text: "Busco apoio de quem é próximo antes de decidir", dims: {REL:3, EMO:1} },
          { text: "Foco no primeiro passo concreto e dou ele", dims: {EXE:3} }
        ]
      },
      {
        context: "Uma semana pesada",
        text: "Tudo acumulou ao mesmo tempo e o estresse subiu. Qual é a sua reação mais natural?",
        opts: [
          { text: "Faço uma lista e ataco por prioridade", dims: {SIS:3} },
          { text: "Vou resolvendo no impulso, uma coisa atrás da outra", dims: {EXE:3, VEL:2} },
          { text: "Paro, respiro e cuido de não me sobrecarregar", dims: {EMO:3} },
          { text: "Peço ajuda e divido as tarefas", dims: {REL:3} }
        ]
      },
      {
        context: "Alguém precisa de você num momento ruim",
        text: "Uma pessoa querida está passando por um perrengue e te procura. Como você aparece pra ela?",
        opts: [
          { text: "Escuto de verdade, sem pressa de resolver", dims: {EMO:3, REL:2} },
          { text: "Ajudo a organizar a situação e os próximos passos", dims: {SIS:3, REL:1} },
          { text: "Já parto pra ação prática pra aliviar o problema", dims: {EXE:3} },
          { text: "Trago leveza e esperança pra pessoa respirar", dims: {AMB:2, EMO:2} }
        ]
      },
      {
        context: "Hora de negociar",
        text: "Você quer um valor (um preço, um acordo, um aumento) e a primeira oferta veio bem abaixo. O que faz?",
        opts: [
          { text: "Apresento dados e argumentos pra sustentar meu pedido", dims: {SIS:3, EXE:1} },
          { text: "Agradeço, peço um tempo e volto com uma contraproposta", dims: {EMO:3, SIS:1} },
          { text: "Coloco logo o número que eu quero, sem rodeio", dims: {VEL:3, EXE:1} },
          { text: "Busco uma saída que seja boa pros dois lados", dims: {REL:3, AMB:1} }
        ]
      },
      {
        context: "Um sonho que está parado",
        text: "Tem um projeto pessoal seu que vive sendo adiado. O que destrava você?",
        opts: [
          { text: "Quebrar em metas pequenas e marcar no calendário", dims: {SIS:3} },
          { text: "Simplesmente começar, mesmo imperfeito", dims: {EXE:3, VEL:2} },
          { text: "Contar pra alguém pra me cobrar", dims: {REL:3} },
          { text: "Aceitar que vai ser incerto e ir assim mesmo", dims: {AMB:3} }
        ]
      },
      {
        context: "Recebendo uma crítica",
        text: "Alguém te dá um retorno duro sobre algo que você fez. Qual é a sua primeira reação por dentro?",
        opts: [
          { text: "Respiro e separo o que é útil do que é só desabafo", dims: {EMO:3} },
          { text: "Analiso o que aconteceu pra entender onde melhorar", dims: {SIS:3} },
          { text: "Pergunto mais pra pessoa pra entender o ponto de vista dela", dims: {REL:3} },
          { text: "Já penso no que mudar e parto pra ação", dims: {EXE:2, VEL:2} }
        ]
      },
      {
        context: "Decidir em grupo, sem acordo",
        text: "Um grupo precisa decidir algo e ninguém concorda. O tempo está passando. O que você faz?",
        opts: [
          { text: "Estruturo a conversa: critérios claros e uma votação", dims: {SIS:2, REL:2} },
          { text: "Proponho uma decisão e sigo — depois a gente ajusta", dims: {VEL:3, EXE:1} },
          { text: "Garanto que todos sejam ouvidos antes de fechar", dims: {REL:3, EMO:1} },
          { text: "Sugiro testar duas opções e ver qual funciona", dims: {AMB:3} }
        ]
      },
      {
        context: "Um perrengue financeiro",
        text: "Veio uma despesa inesperada que apertou o orçamento. Como você reage?",
        opts: [
          { text: "Refaço as contas e corto o que dá pra cortar", dims: {SIS:3, EMO:1} },
          { text: "Corro atrás de uma renda extra rapidinho", dims: {EXE:3, VEL:2} },
          { text: "Converso com a família/pessoas pra resolver junto", dims: {REL:3} },
          { text: "Mantenho a calma — já passei por pior e dei a volta", dims: {EMO:3, AMB:1} }
        ]
      },
      {
        context: "Quando tudo está previsível demais",
        text: "Sua rotina está estável, mas meio sem graça. O que isso desperta em você?",
        opts: [
          { text: "Vontade de buscar um desafio ou algo novo", dims: {AMB:3, VEL:1} },
          { text: "Alívio — gosto de estabilidade pra construir", dims: {SIS:2, EMO:2} },
          { text: "Energia pra adiantar projetos parados", dims: {EXE:3} },
          { text: "Vontade de fortalecer laços com as pessoas", dims: {REL:3} }
        ]
      },
      {
        context: "Ser referência sem ter o cargo",
        text: "Numa situação, as pessoas começam a olhar pra você esperando direção — mesmo sem você ser 'o chefe'. Como age?",
        opts: [
          { text: "Organizo quem faz o quê e dou o ritmo", dims: {SIS:2, EXE:2} },
          { text: "Cuido do clima e mantenho todos juntos", dims: {REL:3, EMO:1} },
          { text: "Defino o próximo passo e puxo a ação", dims: {EXE:2, VEL:2} },
          { text: "Escuto o grupo e construo a decisão com ele", dims: {REL:2, AMB:2} }
        ]
      },
      {
        context: "Regras que parecem sem sentido",
        text: "Você se depara com uma regra (no trabalho, no estudo, na vida) que acha que não faz sentido. O que faz?",
        opts: [
          { text: "Sigo por ora, mas levanto o ponto do jeito certo", dims: {SIS:3, EMO:1} },
          { text: "Procuro um caminho próprio que funcione melhor", dims: {AMB:3, VEL:1} },
          { text: "Converso com quem pode mudar a regra", dims: {REL:3} },
          { text: "Testo uma alternativa na prática pra provar que dá certo", dims: {EXE:3} }
        ]
      },
      {
        context: "Seu jeito de recarregar",
        text: "Você finalmente tem um tempo livre. O que te recarrega de verdade?",
        opts: [
          { text: "Organizar coisas e planejar os próximos passos", dims: {SIS:3} },
          { text: "Estar com gente que eu gosto", dims: {REL:3, EMO:1} },
          { text: "Viver algo novo — um lugar, um livro, uma ideia fora da bolha", dims: {AMB:3} },
          { text: "Descansar sem culpa — recarregar também é produtivo", dims: {EMO:3} }
        ]
      }
    ],
    archetypes: [
      {
        id: 'arquiteto',
        name: 'O Arquiteto',
        icon: '🏗️',
        mode: 'Cria ordem no meio do caos',
        dims: ['SIS','AMB'],
        desc: 'Você junta duas coisas raras: gosta de organizar e não se assusta com o incerto. Onde os outros veem bagunça, você começa a desenhar um caminho. Isso vale tanto pra um projeto no trabalho quanto pra organizar a vida quando tudo parece confuso.',
        insights: [
          { icon:'⚡', title:'Sua força', text:'Transformar confusão em clareza. Você consegue dar os primeiros passos mesmo quando nada está definido.' },
          { icon:'🪞', title:'Seu ponto cego', text:'Às vezes você quer estruturar tanto que demora pra sair do lugar. Nem tudo precisa estar perfeito pra começar.' },
          { icon:'🌱', title:'Como evoluir', text:'Treine entregar uma primeira versão "boa o suficiente" e melhorar depois. Coloque um prazo curto pra sair do planejamento e ir pra ação.' },
          { icon:'🧭', title:'Onde você brilha', text:'Coisas novas, sem manual: começar um projeto, organizar uma mudança, estruturar uma ideia. Áreas como projetos, planejamento, empreender, pesquisa.' },
          { icon:'💬', title:'Pra refletir', text:'Qual ideia sua está esperando "o plano perfeito" pra começar — e o que você poderia testar essa semana?' }
        ]
      },
      {
        id: 'executor',
        name: 'O Realizador',
        icon: '🔩',
        mode: 'Põe a mão na massa e entrega',
        dims: ['EXE','VEL'],
        desc: 'Você não trava: decide, faz e ajusta no caminho. Tem uma energia natural pra tirar as coisas do papel — seja uma tarefa, um perrengue ou um sonho. As pessoas perto de você costumam se mover mais rápido por causa disso.',
        insights: [
          { icon:'⚡', title:'Sua força', text:'Fazer acontecer. Você transforma intenção em resultado mais rápido do que a maioria.' },
          { icon:'🪞', title:'Seu ponto cego', text:'A pressa pode gerar retrabalho. Às vezes correr custa mais caro do que parar 10 minutos pra pensar.' },
          { icon:'🌱', title:'Como evoluir', text:'Antes de decisões grandes, escreva as opções e durma sobre elas uma noite. Pergunte "qual o custo de errar aqui?" antes de acelerar.' },
          { icon:'🧭', title:'Onde você brilha', text:'Ambientes de ritmo rápido e metas claras: vendas, operações, atendimento, empreender, esportes, qualquer coisa que exija tirar do papel.' },
          { icon:'💬', title:'Pra refletir', text:'Onde a sua pressa já te custou caro — e como você perceberia, da próxima vez, que vale desacelerar?' }
        ]
      },
      {
        id: 'conector',
        name: 'O Conector',
        icon: '🔗',
        mode: 'Decide pensando nas pessoas',
        dims: ['REL','EMO'],
        desc: 'Você lê o ambiente pelas pessoas: percebe como estão se sentindo, o que não foi dito, quem precisa de apoio. Essa sensibilidade é rara e faz diferença em qualquer grupo — na família, entre amigos ou no trabalho.',
        insights: [
          { icon:'⚡', title:'Sua força', text:'Criar confiança e enxergar o que as pessoas sentem. Você une grupos e acalma tensões.' },
          { icon:'🪞', title:'Seu ponto cego', text:'Cuidar tanto dos outros que esquece de você — e adiar conversas difíceis pra não magoar ninguém.' },
          { icon:'🌱', title:'Como evoluir', text:'Pratique dizer o que você precisa, com clareza e gentileza. Lembre: evitar um conflito hoje costuma criar um maior amanhã.' },
          { icon:'🧭', title:'Onde você brilha', text:'Tudo que envolve gente: cuidado, ensino, atendimento, liderança, saúde, recursos humanos, comunidades, causas.' },
          { icon:'💬', title:'Pra refletir', text:'Qual conversa importante você está adiando pra não desagradar — e o que mudaria se você a tivesse?' }
        ]
      },
      {
        id: 'analista',
        name: 'O Analista',
        icon: '📐',
        mode: 'Pensa com método e capricho',
        dims: ['SIS','EXE'],
        desc: 'Você pensa antes de agir e age com cuidado. Gosta de fazer bem feito, sem deixar pontas soltas. As pessoas confiam em você justamente porque você entrega com qualidade e consistência.',
        insights: [
          { icon:'⚡', title:'Sua força', text:'Confiabilidade. Você entrega o que promete, com capricho — e raramente deixa algo importante passar.' },
          { icon:'🪞', title:'Seu ponto cego', text:'Buscar o perfeito pode te deixar lento ou exigente demais (com você e com os outros).' },
          { icon:'🌱', title:'Como evoluir', text:'Defina, pra cada tarefa, o nível de capricho que ela realmente exige — nem tudo merece 100%. Pratique decidir com 80% da informação.' },
          { icon:'🧭', title:'Onde você brilha', text:'Onde qualidade importa mais que pressa: finanças, dados, jurídico, saúde, engenharia, qualidade, planejamento, ofícios técnicos.' },
          { icon:'💬', title:'Pra refletir', text:'Onde o seu "caprichar mais" virou "travar mais" — e o que aconteceria se você entregasse antes?' }
        ]
      },
      {
        id: 'estrategista',
        name: 'O Navegador',
        icon: '🧭',
        mode: 'Ágil em terreno incerto',
        dims: ['AMB','VEL'],
        desc: 'Você se move bem quando o mapa não existe. Não precisa de tudo definido: lê os sinais, testa, ajusta e segue. Em situações novas ou que mudam o tempo todo, você acha caminho onde os outros veem beco.',
        insights: [
          { icon:'⚡', title:'Sua força', text:'Avançar no incerto sem paralisar. Você se adapta rápido e enxerga saídas criativas.' },
          { icon:'🪞', title:'Seu ponto cego', text:'Tanta adaptabilidade pode virar falta de profundidade. Algumas coisas pedem persistência, não mais um plano novo.' },
          { icon:'🌱', title:'Como evoluir', text:'Escolha uma ou duas coisas pra ir até o fim, mesmo quando der vontade de mudar. Termine antes de começar a próxima.' },
          { icon:'🧭', title:'Onde você brilha', text:'Mudança e novidade: empreender, inovação, projetos, vendas, criação, ambientes que se transformam rápido.' },
          { icon:'💬', title:'Pra refletir', text:'O que você começou e não terminou — e qual dessas coisas merece a sua persistência agora?' }
        ]
      },
      {
        id: 'guardiao',
        name: 'O Guardião',
        icon: '🛡️',
        mode: 'Cuida das pessoas com organização',
        dims: ['REL','SIS'],
        desc: 'Você junta cuidado com as pessoas e senso de organização. Cria ambientes onde os outros se sentem seguros e sabem o que esperar. É a pessoa em quem todos confiam — porque você é justo, presente e constante.',
        insights: [
          { icon:'⚡', title:'Sua força', text:'Construir confiança que dura. Você cria estabilidade e cuida pra que ninguém fique pra trás.' },
          { icon:'🪞', title:'Seu ponto cego', text:'Decisões difíceis que afetam pessoas podem ser adiadas demais. Proteger todo mundo às vezes trava o necessário.' },
          { icon:'🌱', title:'Como evoluir', text:'Pratique tomar a decisão dura quando ela é justa, mesmo que desconforte. Cuidar também é ser honesto a tempo.' },
          { icon:'🧭', title:'Onde você brilha', text:'Cuidar de pessoas e de processos ao mesmo tempo: liderança, educação, saúde, gestão, comunidade, qualquer time que precise de base sólida.' },
          { icon:'💬', title:'Pra refletir', text:'Que decisão justa você está adiando pra evitar desconforto — e quem ganharia se você a tomasse?' }
        ]
      }
    ]
  },

