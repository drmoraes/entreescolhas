# Entre Escolhas — Análise Estratégica de Branding, UX/UI e Conversão

Análise feita sobre o site em produção (https://www.entreescolhas.com.br), versão atual em 2026-06-29.

---

## Veredito rápido: você está certo ou errado?

Certo, parcialmente. O site **não está confuso** — a proposta de "leitura comportamental por cenários" está coerente, o disclaimer "não é teste psicológico" aparece nos lugares certos, e a transparência (preço fixo, LGPD, "somos novos") é um diferencial real, não um problema. Onde você está certo: falta um **ponto de ancoragem visual** — hoje quase tudo é texto + gradiente + emoji, e isso empurra a marca pra perto de "quiz" quando o produto merece ser percebido como "assessment sério e acessível". Onde você está errado: o problema não é falta de imagem genérica (foto de pessoa sorrindo), é falta de **um sistema visual próprio** — ilustração, ícone, mockup — que carregue peso emocional sem virar clichê de RH corporativo ou misticismo de teste de personalidade.

Resumindo: a copy já faz 70% do trabalho. O design visual está atrás da copy.

---

## 1. Clareza da proposta de valor

| Pergunta | Hoje no site | Veredito |
|---|---|---|
| O que é? | "Leitura situacional de padrões de decisão" — claro no H1 | ✅ Claro |
| Qual problema resolve? | Implícito ("você não está perdido... nunca foi visto de verdade") | ⚠️ Emocional, mas não nomeia a dor concreta (career drift, decisões mal explicadas, autoconhecimento caro) |
| Qual benefício entrega? | "Entenda como você decide" | ⚠️ Genérico — falta concretude (o que muda na prática depois?) |
| Qual público deve usar? | **Não está dito em lugar nenhum** | ❌ Maior gap do site. Não há seção "para quem é" |
| Por que confiar? | Seção "Por que confiar" existe e é boa | ✅ Ponto forte real do site |
| Por que agora? | "Resultado imediato", contador de "1 milhão" | ⚠️ Presente mas fraco — não há urgência genuína, só ausência de fricção |

O maior furo não é estético, é estratégico: **ninguém diz para quem isso é**. Estudante escolhendo carreira? Profissional pensando em trocar de emprego? Líder entendendo a própria liderança? Sem isso, a pessoa não se vê no produto nos primeiros 5 segundos — e é exatamente esse o sintoma que você percebeu como "falta de desejo imediato".

### Nova proposta de valor central

> **O Entre Escolhas não mede quem você é. Mostra como você age — em decisões, relações e escolhas de carreira reais — e te dá um plano prático para evoluir a partir disso.**

(Evolução da frase que você sugeriu — manteve a negação do "teste de personalidade", mas trocou "ajudar a entender" — passivo — por "te dá um plano prático" — ativo, com entrega concreta.)

### 5 variações de headline (topo do site)

| Versão | Headline |
|---|---|
| **Emocional** | "Você não escolhe por acaso. Descubra o padrão por trás das suas decisões." |
| **Profissional** | "Uma leitura comportamental baseada em cenários reais — não em autoavaliação." |
| **Jovem/digital** | "Seu jeito de decidir tem um padrão. A gente te mostra qual é, em 20 min." |
| **Carreira** | "Entenda como você decide, se relaciona e escolhe — antes da sua próxima decisão de carreira." |
| **Empresas/RH** | "Saiba como as pessoas do seu time realmente decidem sob pressão — não como elas dizem que decidem." |

---

## 2. Teste dos 5 segundos

**O que o usuário entende:** é sobre comportamento/decisão, dura ~20 min, tem versão grátis, relatório pago é barato (R$ 9,90), não é teste psicológico.

**O que ele provavelmente não entende:** se isso é pra carreira, relacionamento pessoal, ou os dois; se vale a pena versus um DISC ou 16Personalities que ele já conhece; o que exatamente o "padrão" vai te dizer que você já não sabe sobre si.

**O que gera dúvida:** "leitura de tendências" — termo vago, pode soar como eufemismo de horóscopo se não for ancorado em exemplo concreto logo no hero.

**O que gera desconfiança:** marca nova, zero prova social visível na primeira tela (a seção que resolve isso vem só depois de rolar a página); existência do "Banco de Talentos" pode gerar o pensamento "isso é um teste ou é uma armadilha pra recrutamento?" — mitigado pelos disclaimers, mas só quem rola a página até o FAQ vê isso.

**O que falta para querer clicar:** ver um pedaço real do relatório (a prévia existe, mas está a 4 rolagens de distância) e entender o ganho prático imediato — hoje a promessa é "autoconhecimento", que é abstrato; falta "e da pra usar isso na sua próxima decisão de carreira esta semana".

**Mensagem prioritária acima da dobra:** O QUÊ (leitura situacional) + DIFERENCIAL (não é traço, é comportamento real) + AÇÃO (comece grátis, veja sua leitura em 20 min).

### Proposta de hero

- **Headline:** "Você não escolhe por acaso. Descubra o padrão por trás das suas decisões."
- **Subheadline:** "20 cenários reais de trabalho, dinheiro e relações. Sem autoavaliação, sem rótulo fixo — só o que você realmente faria. Relatório com leitura prática e plano de ação gerado por IA."
- **CTA principal:** "Começar minha leitura — grátis"
- **CTA secundário:** "Ver um relatório de exemplo" (ancora na seção de preview, sem sair da página)
- **Microcopy de confiança:** "Não é teste psicológico · Resultado em 20 min · R$ 9,90 só se quiser o relatório completo"
- **Elemento visual recomendado:** ilustração de linha (não foto) de um caminho que se bifurca em 4 nós — um nó por jornada — convergindo num retrato abstrato/silhueta central. É o mesmo motivo do SVG que já existe na seção emocional, só que **promovido pro hero**, em escala maior, como peça central, não decoração de rodapé.
- **Prova social/autoridade:** como ainda não há prova social real, substituir por **prova de método**: "Cada cenário foi validado com profissionais de RH e psicologia comportamental antes de entrar no teste" (se for verdade — se não for, trocar por algo verificável, nunca inventar número).
- **Estrutura visual da primeira tela:** 60% esquerda = headline + subhead + CTA + microcopy; 40% direita = ilustração de caminho bifurcado SUBSTITUINDO ou coexistindo com o card de cenário interativo atual (o card interativo é ótimo, é o melhor elemento de engajamento do site hoje — sugiro manter ele, mas com a ilustração como camada de fundo, não competindo por espaço).

---

## 3. Análise dos 4 testes/jornadas

| Teste | Promessa | Dor que resolve | Público | Sobreposição | Nome | Desejável? |
|---|---|---|---|---|---|---|
| **Arquétipo / Leitura de Padrões de Decisão** | Como você decide sob pressão | Não entender por que trava ou age por impulso | Universal — bom ponto de entrada | Baixa | Forte, claro | Sim |
| **Fit Cultural & Carreira** | Em que ambiente você floresce | Sensação de "lugar errado" no trabalho | Quem está insatisfeito no emprego atual | **Alta com Bússola** | Médio — "fit cultural" é jargão de RH | Parcial |
| **Scanner de Relacionamento** | Como você se conecta e lida com conflito | Atrito com colegas/liderança, dificuldade de influenciar | Líderes, quem lida com gente | Baixa | Forte, nome moderno | Sim |
| **Bússola Vocacional** | O que move suas escolhas de carreira | Falta de direção/propósito | Quem está em transição ou começando carreira | **Alta com Fit Cultural** | Forte, evocativo | Sim |

**Veredito:** manter os 4 — mas não como estão hoje. O problema real não é excesso de testes, é a **falta de uma lógica de portfólio**. "Fit Cultural" e "Bússola Vocacional" competem pelo mesmo território mental do usuário (ambos = "carreira/direção"), enquanto "Arquétipo" e "Scanner" já são claramente distintos (decisão vs. relação). Sem uma estrutura que separe os 4 em eixos diferentes, o usuário vê 4 quizzes parecidos, não 4 lentes complementares — e é isso que parece "excesso de informação".

### Arquitetura recomendada: 2 eixos, 4 lentes

```
                  EU (interno)        EU COM O MUNDO (externo)
DECISÃO/CARREIRA   Arquétipo            Bússola Vocacional
                  (como decido)        (pra onde decido ir)

RELACIONAL/AMBIENTE  Scanner            Fit Cultural
                  (como me conecto)    (onde floresço)
```

- **Narrativa que conecta os 4:** "Você não é uma coisa só. Você decide de um jeito, se relaciona de outro, floresce em certos ambientes e é movido por certas coisas. As 4 jornadas juntam essas peças num só retrato."
- **Ordem ideal de apresentação:** Arquétipo (entrada gratuita, mais universal) → Scanner (camada interpessoal, gera curiosidade rápida) → Fit Cultural (aplica ao trabalho atual) → Bússola (visão de futuro/carreira). Lógica: de dentro pra fora, do presente pro futuro.
- **Nomes ajustados:**
  - Arquétipo → manter, já é forte.
  - Fit Cultural & Carreira → **"Ambiente Ideal"** (mais simples, menos jargão de RH, mais desejável pra quem não é da área).
  - Scanner de Relacionamento → manter, nome moderno e único no mercado.
  - Bússola Vocacional → manter, já é a melhor metáfora do conjunto.
- **Forma visual de explicar os 4 sem parecer excesso:** trocar o grid atual (4 cards verticais idênticos, todos com o mesmo peso) por um **diagrama 2x2 com um nó central "Você"** — um SVG único, com os 4 ícones nas pontas conectados ao centro. Isso comunica "4 ângulos de uma coisa" em vez de "4 produtos separados pra escolher", que é exatamente a confusão que você sentiu.

---

## 4. Excesso de texto e hierarquia visual

| Bloco atual | Hoje | Recomendação |
|---|---|---|
| "Por que confiar" (3 parágrafos) | Texto corrido em cards | Manter como card, mas cortar pra 1 frase por card (já é quase isso — só apertar) |
| "Relatório completo inclui" (6 itens com ✓) | Lista de texto | Virar grid de 3 ícones + 3 ícones (2 linhas de 3), mais escaneável que lista vertical |
| "Quem somos" (3 parágrafos) | Bom uso de ícone, texto ainda longo | Cortar cada parágrafo à metade — 1 frase de fato, não 2-3 |
| 4 cards de jornada | Texto descritivo de 1 frase cada — ok | Resolvido pela mudança de arquitetura (item 3) — menos sobre reduzir texto, mais sobre reorganizar visualmente |
| FAQ | Já é accordion — correto | Manter, é o padrão certo aqui |
| Indique e ganhe | Já é 3 steps com ícone — correto | Manter |

**Textos que podem ser reduzidos:** "Quem somos", lista de benefícios do relatório, microcopy de legal/privacidade no rodapé do pricing (pode virar link "Termos completos" em vez de parágrafo inteiro visível).

**Textos que precisam ficar como estão:** todos os disclaimers de "não é teste psicológico" / LGPD — aqui menos é pior, é a base de confiança do site, não cortar.

**Onde usar progressive disclosure:** a seção de privacidade/legal no pricing já citada — resumir em 1 linha + link "saiba mais"; o detalhamento de "tensões observadas" no preview do relatório pode ficar parcialmente visível com "ver relatório completo" expandindo o resto.

---

## 5. Direção de imagem e design gráfico

**O que falta hoje:** o site usa gradiente + emoji + ícone de borda fina. Funciona, mas não tem **uma peça de identidade visual própria** — nada que alguém reconheça como "ah, isso é do Entre Escolhas" se visse fora de contexto. Emoji (🧠🎯🔗🧭, 🔍🤝🛡️) é o maior risco de marca: emoji comunica "ferramenta casual/quiz", e o produto quer comunicar "leitura seria, aplicável à carreira". É pequeno, mas pesa.

| Elemento | Recomendação |
|---|---|
| Estilo de imagem | Sem fotografia de banco de imagens. Zero "pessoas de terno apertando as mãos" — isso é clichê de RH corporativo e contradiz "transparência radical, somos novos" |
| Ilustração | Linha fina, geométrica, abstrata — caminhos, nós, bifurcações (extensão do SVG já criado). Não usar silhuetas humanas detalhadas — usar formas/pontos que sugerem pessoa sem retratar uma "pessoa-modelo" genérica |
| Pessoas reais | Só quando houver prova social real (depoimento verdadeiro com nome/foto consentida) — nunca antes disso, sob risco de parecer fabricado, o que contradiz o pilar de transparência |
| Cenas profissionais | Evitar fotos; se necessário, usar somente como textura de fundo discreta, nunca como protagonista visual |
| Metáforas visuais | Caminho/bifurcação (decisão), lente/scanner (relacionamento), bússola (vocação), mapa de calor de 6 dimensões (já existe no relatório, é o melhor ativo visual do site hoje) |
| Ícones | Substituir todos os emoji por um set de ícones de linha único e consistente (24px, stroke 2px, cantos arredondados) — 15-20 ícones cobrem o site inteiro |
| Cards | Manter o padrão atual (fundo escuro, borda 1px roxa, hover com leve elevação) — já está bom, só padronizar em todo o site |
| Mockup de relatório | Já existe e é o melhor elemento do site — sugiro emoldurar em um "frame" de navegador/app pra parecer ainda mais produto real, não só uma div solta |
| Antes/depois | Não existe hoje. Sugestão: pequeno bloco "Antes da leitura / Depois da leitura" em 2 colunas curtas — barato de produzir, alto impacto de clareza de benefício |

### Direção visual consolidada

- **Paleta:** manter #6C63FF (roxo) como cor de marca e #C9A84C (dourado) como cor de "premium/IA" — já funciona e está sendo usado com essa lógica. Adicionar 1 neutro quente (ex. `#F5F3EF` em off-white) reservado só para blocos que precisam respirar — hoje o site é 100% escuro, o que cansa em páginas longas.
- **Tipografia:** sans humanista para corpo/UI (Inter, General Sans ou similar) + 1 serifada (Fraunces, Lora) só para a palavra de destaque no H1/H2 — o site já faz isso parcialmente (`.grad.serif`), só formalizar como regra em todo o site.
- **Botões:** manter pílula com gradiente no CTA primário; CTA secundário sempre como link sublinhado ou ghost-button, nunca dois botões "cheios" competindo.
- **Cards:** fundo `--bg-card`, borda 1px `--border`, hover = leve elevação + borda mais clara. Padrão já bom, replicar 100%.
- **Ilustrações:** linha fina monocromática + 1 cor de destaque por peça (nunca as duas cores de marca brilhando juntas na mesma ilustração, senão perde hierarquia).
- **Ícones:** um set único, nunca emoji.
- **Clima visual:** "laboratório de comportamento acessível" — mistura de seriedade científica com calor humano. Referência de tom: Notion (clareza) + Headspace (calor, sem infantilizar) — não horóscopo, não corporate RH genérico.
- **Evitar:** emoji como ícone, estrelas/cristais/místico, fotos de stock corporativo, qualquer "diagnóstico" ou "personalidade fixa" na linguagem visual (nada de cartas de tarot, nada de "tipos" emolduradas como destino).

---

## 6. Engajamento e desejo

Por que a pessoa talvez não comece: o ganho é abstrato ("autoconhecimento") e o produto é desconhecido. Os gatilhos que faltam são, em ordem de impacto esperado: **exemplo concreto de resultado** (maior alavanca — já existe, mas está escondido demais), **pergunta provocativa no hero** (gera o "isso é sobre mim" imediato), e **simulação leve antes do cadastro** (o card interativo já faz isso — só faltou conectar a uma recompensa: ao escolher uma opção, mostrar um microinsight tipo "quem escolhe isso tende a decidir por consenso" antes mesmo de pedir e-mail).

### 20 headlines

1. Você não escolhe por acaso. Descubra o padrão por trás das suas decisões.
2. Suas escolhas têm um padrão. A maioria das pessoas nunca viu o seu.
3. Como você decide quando ninguém está observando?
4. 20 minutos. 4 lentes. Um retrato real de como você age.
5. Antes de tomar sua próxima decisão grande, entenda como você decide as pequenas.
6. Você se conhece pelo que diz — ou pelo que faz quando o cenário aperta?
7. Testes de personalidade dizem quem você é. Aqui a gente mostra como você age.
8. O autoconhecimento que cabe no seu bolso — e na sua próxima decisão de carreira.
9. Decisão, relação, ambiente, propósito: 4 ângulos, 1 padrão.
10. Pare de adivinhar por que você trava nas decisões importantes.
11. Sua forma de decidir tem nome. Em 20 minutos você descobre qual.
12. Não é sobre quem você é. É sobre como você age quando importa.
13. O que suas últimas 5 decisões difíceis revelam sobre você?
14. Comportamento real, não autoavaliação. Cenários reais, não perguntas genéricas.
15. Você floresce em qualquer ambiente — ou só em alguns? Descubra qual.
16. Sua próxima escolha de carreira fica mais fácil quando você entende a anterior.
17. Sem rótulo. Sem caixinha fixa. Só o seu padrão de decisão, hoje.
18. O teste que te dá um plano, não só um resultado.
19. Decida melhor a partir de hoje — entendendo como você decide há anos.
20. Quem te conhece de verdade? Comece descobrindo você mesmo.

### 20 CTAs

1. Começar minha leitura — grátis
2. Ver como eu decido
3. Descobrir meu padrão agora
4. Quero ver um exemplo de relatório
5. Fazer minha leitura de 20 minutos
6. Começar grátis, sem cartão
7. Entender minhas escolhas
8. Quero meu retrato comportamental
9. Testar o primeiro cenário agora
10. Começar sem compromisso
11. Ver minha leitura completa
12. Descobrir onde eu floresço
13. Encontrar meu padrão de decisão
14. Quero meu plano de ação
15. Iniciar minha jornada gratuita
16. Ver o que minhas escolhas revelam
17. Começar minha análise agora
18. Desbloquear minha leitura completa
19. Quero entender meu comportamento
20. Experimentar gratuitamente

---

## 7. Confiança e credibilidade

| Item | Existe hoje? | Nota |
|---|---|---|
| Prova social | Não — e o site admite isso de forma transparente | Honesto, mas ainda é um vazio. Compensar com prova de método, não inventar depoimento |
| Explicação metodológica | Parcial, só no FAQ | Subir pra uma seção própria "Como funciona", com diagrama, não parágrafo |
| Exemplo de relatório | Sim, é o melhor ativo do site | Manter e destacar mais (subir posição) |
| Transparência sobre IA | Parcial — aparece como "diagnóstico de coaching por IA" sem explicar o que é IA e o que é determinístico | Adicionar 1 linha: "o relatório usa IA para personalizar a leitura com base nas suas respostas — sem diagnóstico fixo" |
| Clareza "não é teste psicológico" | Sim, repetido em vários lugares | Ponto forte, manter |
| LGPD/privacidade | Sim, bem comunicado | Ponto forte, manter |
| Risco do Banco de Talentos parecer "armadilha de recrutamento" | Mitigado por disclaimers, mas mal posicionado (vem cedo na home, antes do valor principal estar consolidado) | Mover para depois da seção de benefícios/prova social, sempre como "bônus opcional", nunca como segunda oferta concorrente com o relatório |

### Seções propostas

- **Como funciona:** já existe, ótima base — só adicionar 1 diagrama visual (situação → escolha → padrão → leitura) no lugar de só texto.
- **O que você recebe:** consolidar a lista de benefícios em ícone-grid (ver item 4).
- **O que este teste não é:** seção nova, curta, 3 bullets: "não é teste psicológico", "não rotula você de forma fixa", "não garante vaga ou emprego" — hoje isso está disperso, juntar numa seção dedicada aumenta a sensação de honestidade.
- **Por que confiar:** já existe e é boa, manter.
- **Exemplo de resultado:** já existe (report preview), só subir a posição na página.
- **FAQ:** já existe e está bem feito.
- **Banco de Talentos — comunicação ética:** sempre "depois" do valor central, sempre com a frase "opcional, não garante vaga", sempre com opt-in explícito (já implementado no checkbox de aceite) — manter esse padrão rigorosamente em qualquer nova peça de copy.

---

## 8. IA no resultado final — estrutura do relatório

O MVP atual (insight / oportunidade / ação prática) está correto como ponto de partida — é honesto, não rotula, é acionável. Para evoluir com responsabilidade, a estrutura completa recomendada:

1. **Resumo executivo do perfil** — 2-3 frases, sem jargão.
2. **Padrões de decisão** — como a pessoa decide sob pressão, com base nas respostas, não em traço fixo.
3. **Estilo de relacionamento** — como tende a se conectar e lidar com conflito.
4. **Ponto forte dominante** — 1 força clara, com exemplo de quando ela aparece.
5. **Ponto cego provável** — sempre como possibilidade ("pode ser que..."), nunca como sentença ("você é...").
6. **Riscos comportamentais em contexto profissional** — linguagem de risco situacional, não de defeito de caráter.
7. **Sugestão de carreira/desenvolvimento** — direção, não prescrição.
8. **Plano de ação de 7 dias** — 1 ação concreta, pequena, testável.
9. **Plano de ação de 30 dias** — 1 hábito ou prática a sustentar.
10. **Perguntas de reflexão de coaching** — 2-3 perguntas abertas, não afirmações.
11. **Recomendações para conversa com mentor/líder/RH** — frases prontas que a pessoa pode literalmente usar numa 1:1.

Regras de linguagem para o prompt de IA (a manter sempre): nunca usar verbos de rótulo fixo ("você é"), preferir "você tende a", "nas suas respostas, aparece...", sempre incluir verbo de ação no plano, nunca gerar afirmação clínica ou de diagnóstico, sempre fechar com tom acolhedor, não alarmista.

Isso é uma evolução de produto, não uma correção — recomendo tratar como **fase 2** do recurso de IA já implementado (ver backlog).

---

## 9. Concorrência e posicionamento

| Concorrente | Onde é forte | Onde Entre Escolhas vence |
|---|---|---|
| Testes vocacionais gratuitos | Distribuição, gratuidade | Profundidade, aplicação prática de carreira |
| DISC | Peso institucional, uso corporativo consolidado | Linguagem humana, foco no indivíduo (não treinamento corporativo) |
| MBTI / 16Personalities | Tráfego orgânico gigantesco, UX polida | Base situacional (o que você faria) vs. autoavaliação de traço (como você se vê) — diferencial real e defensável |
| Mindsight, Gupy, Solides | B2B/RH, contratação em massa, peso institucional | B2C direto — a pessoa é a cliente, não a empresa; banco de talentos é bônus, não o produto |
| Coaching/orientação de carreira paga | Profundidade humana, 1:1 | Preço (R$ 9,90 vs. sessões caras), instantaneidade |

**Onde o Entre Escolhas é genérico hoje:** o grid de 4 testes (resolvido no item 3) e o visual (resolvido no item 5) — não o conteúdo nem a metodologia, que já são diferenciados.

**Categoria a ocupar:** "autoconhecimento aplicado à carreira" — nem teste de personalidade (genérico, sem aplicação), nem assessment de RH (institucional, não é pra você, é pra empresa).

**Inimigo de marca:** o teste de personalidade que rotula e não aplica nada ("parabéns, você é INFJ — e agora?"). Atacar a falta de utilidade prática dos testes de traço é o ângulo mais forte e mais fácil de defender.

**Posicionamento (versão final, evoluída da sua sugestão):**

> "Testes de personalidade dizem quem você é. O Entre Escolhas mostra como você age — em decisões, relações e escolhas de carreira reais — e te entrega um plano prático pra evoluir a partir disso."

---

## 10. Nova arquitetura da home

| # | Seção | Título | Objetivo | Visual | CTA |
|---|---|---|---|---|---|
| 1 | Hero | (ver item 2) | Comunicar o quê + diferencial + ação em 5s | Ilustração de caminho bifurcado + card interativo | Começar minha leitura — grátis |
| 2 | Como funciona | "3 passos, sem enrolação" | Reduzir fricção/dúvida sobre o processo | Diagrama horizontal com 3 ícones conectados | — |
| 3 | Os 4 testes | "4 lentes, 1 padrão" | Mostrar portfólio sem parecer excesso | Diagrama 2x2 com nó central "Você" | Escolher minha primeira jornada |
| 4 | Exemplo do relatório | "Veja antes de pagar" | Reduzir risco percebido, mostrar entrega real | Mockup com frame de produto | Ver relatório completo |
| 5 | Para quem é (NOVA) | "Pra quem é isso" | Fechar o maior gap de clareza hoje | 3 cards curtos: estudante/transição, profissional insatisfeito, líder/gestor | — |
| 6 | Como a IA ajuda | "Seu plano, gerado pra você" | Diferenciar de teste estático | Ícone de IA + 1 frase de exemplo real de insight | — |
| 7 | Banco de Talentos | "Bônus opcional" | Oferecer sem competir com a oferta principal | Ícone simples, copy curta | Conhecer o Banco de Talentos |
| 8 | Por que confiar | (mantém atual) | Sustentar credibilidade sem prova social fabricada | 3 cards (já existe) | — |
| 9 | FAQ | (mantém atual) | Resolver objeções finais | Accordion (já existe) | — |
| 10 | CTA final | "Pronto pra entender suas escolhas?" | Última conversão | Repetição da ilustração do hero, menor | Começar gratuitamente |

---

## 11. Backlog priorizado

### Fazer agora (baixo custo, alto impacto)
- Trocar todos os emoji por ícones de linha consistentes (já iniciado nos cards de jornada e steps; estender a "Quem somos" e "Indique e ganhe").
- Adicionar seção "Para quem é" (3 cards curtos) — maior gap de clareza, custo de implementação baixo.
- Subir a posição da prévia do relatório (hoje está a 4 rolagens, deveria estar na 2ª ou 3ª seção).
- Reescrever hero com a nova headline/subhead (item 2) — mudança só de copy, sem nova peça visual.
- Consolidar "o que este teste não é" numa seção própria de 3 bullets.

### Fazer depois (precisa de produção/design)
- Ilustração de linha do "caminho bifurcado" em escala de hero (não só decorativa).
- Diagrama 2x2 dos 4 testes substituindo o grid atual.
- Frame de produto (mockup) ao redor do preview do relatório.
- Expandir o relatório de IA para a estrutura completa de 11 blocos (item 8) — é mudança de prompt + UI, não trivial.
- Renomear "Fit Cultural & Carreira" para "Ambiente Ideal" (exige atualizar copy em múltiplas páginas, não só home).

### Testar com usuários antes de decidir
- Headline definitiva entre as 5 variações propostas (rodar como A/B simples).
- Se a simulação no card interativo do hero (mostrar microinsight ao escolher uma opção, antes do cadastro) aumenta ou reduz conversão — pode aumentar engajamento e reduzir urgência de cadastro ao mesmo tempo.
- Posição ideal do Banco de Talentos (antes ou depois do FAQ) — testar com e sem.

---

## 12. Versão final do hero — texto pronto para dev/design

```
[badge]
Novo: diagnóstico de coaching por IA no relatório

[h1]
Você não escolhe por acaso.
Descubra o padrão por trás das suas decisões.

[subhead]
20 cenários reais de trabalho, dinheiro e relações. Sem autoavaliação,
sem rótulo fixo — só o que você realmente faria. Relatório com leitura
prática e plano de ação gerado por IA.

[cta primário] Começar minha leitura — grátis
[cta secundário] Ver um relatório de exemplo

[microcopy de confiança]
Não é teste psicológico · Resultado em 20 min · R$ 9,90 só se quiser
o relatório completo

[elemento visual]
Ilustração de linha: caminho único que se bifurca em 4 nós (um por
jornada), convergindo numa forma central abstrata. Card de cenário
interativo mantido ao lado/sobre a ilustração.
```

---

## Resumo dos entregáveis (referência cruzada com o pedido original)

- **A. Diagnóstico crítico:** seção "Veredito rápido" + item 1.
- **B. Problemas de clareza/engajamento:** item 2.
- **C. Nova proposta de valor:** item 1.
- **D. Nova copy do topo:** itens 1 e 12.
- **E. Nova arquitetura da home:** item 10.
- **F. Manter/reduzir os 4 testes:** item 3 — manter os 4, reorganizar em 2 eixos.
- **G. Direção visual completa:** item 5.
- **H. Imagens/ilustrações que faltam:** item 5.
- **I. Estrutura do relatório com IA:** item 8.
- **J. Comparação com concorrentes:** item 9.
- **K. Backlog priorizado:** item 11.
- **L. Versão final da home:** item 12 (hero) + item 10 (estrutura completa seção a seção).
