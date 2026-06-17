# Checklist final — 2ª rodada (SEO, analytics, LGPD, QA, produção)

Data: 2026-06-17
Escopo: apenas itens não cobertos na 1ª rodada (preço, copy, prova social, "confiança 87%", preview do relatório, WhatsApp, LGPD inicial, canonical). Identidade visual não foi alterada.

## 1. Resumo

Site preparado tecnicamente para tráfego pago: SEO técnico completo, dados estruturados validados, camada de eventos de conversão instalada, consentimentos LGPD separados por finalidade, auditoria de QA/acessibilidade/performance concluída, e produção (Vercel) validada e estabilizada. Um problema crítico de funil (paywall ausente em teste.html) e um problema de DNS (certificado SSL do www) ficam pendentes de decisão sua — detalhados na seção 7.

## 2. Arquivos alterados

- `index.html`, `fit-cultural.html`, `bussola-vocacional.html`, `scanner-relacionamento.html`, `banco-de-talentos.html` — SEO head (robots, OG completo, Twitter Card), JSON-LD, eventos de analytics, correções de copy.
- `teste.html` — eventos de funil (start_test, answer_question, complete_test, view_report_preview).
- `admin.html` — labels de formulário associadas via `for=`/`id` (acessibilidade).
- `analytics.js` (novo) — camada central de eventos `trackEvent`.
- `api/submit.php` — validação server-side dos novos campos de consentimento.
- `.github/workflows/deploy.yml` — conflito de merge resolvido; **recomendado remover** (ver seção 7).
- `sitemap.xml`, `robots.txt` — confirmados consistentes (não alterados nesta rodada, já corretos da rodada anterior).

## 3. SEO técnico — implementado

- Title, description, canonical, OG completo (site_name, image+dimensões+alt, locale) e Twitter Card únicos em todas as páginas indexáveis.
- `robots` meta: `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1` nas páginas de conteúdo; `noindex, follow` em privacidade/termos.
- Hierarquia de heading (h1 único, sem saltos) confirmada em todas as páginas.
- Sitemap e robots.txt consistentes entre si e com o padrão de URLs do projeto (home em `/`, demais páginas com `.html`) — sem mistura de padrões.
- Favicon, apple-touch-icon, manifest.json e og-image padrão confirmados presentes.

## 4. JSON-LD — implementado e validado

- `WebPage` + `BreadcrumbList` + `Service` + `FAQPage` adicionados em fit-cultural.html, bussola-vocacional.html, scanner-relacionamento.html (faltavam nestas três).
- banco-de-talentos.html já tinha JSON-LD válido (WebPage+BreadcrumbList) — mantido sem alteração.
- Todos os blocos novos validados via parser JSON (sintaxe correta).
- Nenhum dado de review/rating, preço ou CNPJ/endereço foi inventado ou marcado sem fonte real.
- teste.html não recebeu JSON-LD — decisão deliberada (página é `noindex`, sem benefício de SEO).

## 5. Analytics e conversão — implementado

Camada central `trackEvent(eventName, payload)` em `analytics.js`, com `window.dataLayer` e pontos de integração comentados para GA4/Meta Pixel (não invasivo, sem captura de dados sensíveis).

Eventos cobertos: `view_home`, `click_start_test`, `start_test`, `answer_question`, `complete_test`, `view_report_preview`, `optin_talent_bank`, `submit_talent_bank`, `click_whatsapp`, `click_privacy_policy`, `click_terms`, `click_faq`, `view_journey_page`, `view_talent_bank_page`, `view_test_intro`.

**Não implementados** (motivo: não existe a funcionalidade correspondente no site): `view_paywall`, `click_unlock_report`, `purchase_report` — ver seção 7.

## 6. LGPD — implementado

- Consentimentos separados em banco-de-talentos.html: termos de uso, política de privacidade, LGPD/dados gerais, ingresso no banco de talentos (com o texto obrigatório verbatim), compartilhamento com empresas parceiras (opt-in adicional e específico).
- Texto de ingresso no banco de talentos conforme exigido: "Autorizo que meu perfil seja considerado para oportunidades profissionais e entendo que meus dados só serão compartilhados com empresas parceiras mediante consentimento explícito. Estou ciente de que a participação no Banco de Talentos não garante vaga, entrevista ou contratação."
- Links de privacidade/termos visíveis, orientação de exclusão (prazo 15 dias) e e-mail de contato (`suporte@entreescolhas.com.br`) presentes.
- Aviso de não-diagnóstico presente no rodapé.
- Validação espelhada no backend (`api/submit.php`).

## 7. Pendências que exigem sua decisão

**Crítico — paywall ausente em teste.html.** O relatório completo é exibido sem nenhuma cobrança ou bloqueio, embora o site comunique em todo lugar o valor de R$ 7,97. Os eventos `view_paywall`/`click_unlock_report`/`purchase_report` não foram implementados porque não há fluxo de pagamento (Mercado Pago ou outro) integrado nessa página. Preciso que você decida: (a) implementar o bloqueio agora, (b) ajustar a comunicação de preço enquanto não há cobrança real, ou (c) está temporariamente assim por algum motivo que eu não tenho contexto.

**DNS — certificado SSL de www.entreescolhas.com.br.** O painel da Vercel mostra "Failed To Generate Cert" para o subdomínio www. Provável causa: registro CNAME ausente/incorreto no painel de DNS do domínio. Não tenho acesso a esse painel — precisa ser verificado por você.

**Workflow de deploy obsoleto.** `.github/workflows/deploy.yml` tentava um deploy via SCP/FTP que não existe (a produção real é via integração nativa Vercel↔GitHub). O job estava falhando a cada push, gerando e-mails de erro do GitHub. Recomendo remover o arquivo (`git rm .github/workflows/deploy.yml`) — ainda não removido, aguardando você rodar o comando.

## 8. QA visual / responsividade

OK em todas as páginas públicas (viewport, media queries, sem grids/larguras fixas problemáticas). `admin.html` tem um modal fixo de 520px sem adaptação mobile (baixo risco — painel interno, não público).

## 9. Acessibilidade

OK em todas as páginas públicas (lang, heading hierarchy, ARIA em FAQ/menu mobile, labels associados). Corrigido nesta rodada: labels do login em `admin.html` sem `for=`. `landing-page-preview.html` tem problemas de acessibilidade (divs sem ARIA), mas é um rascunho não rastreado pelo git e bloqueado no robots.txt — nunca chega à produção, sem ação necessária.

## 10. Performance

Sem problemas óbvios: nenhuma imagem `<img>` no site (tudo SVG/CSS), logo.png (4KB) e og-image.png (92KB) em tamanho adequado. Preconnect de fontes incompleto em admin.html/landing-page-preview.html (baixo impacto, páginas não públicas/não indexadas).

## 11. Itens não validados por falta de acesso

- Comportamento real do certificado SSL/DNS em produção (depende do painel do registrador).
- Execução real do workflow de deploy após a remoção sugerida.
- Testes de carga ou Core Web Vitals reais (Lighthouse/PageSpeed) — esta auditoria foi de código-fonte, não de medição em produção.
- Configuração de GA4/Meta Pixel (pontos de integração estão prontos e comentados, mas não há IDs reais configurados).
