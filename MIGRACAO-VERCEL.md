# Migração do site para a Vercel (sem downtime, sem quebrar o e-mail)

Objetivo: parar de hospedar o site na Locaweb e passar tudo (HTML + funções `api/*.js`)
para a **Vercel**, mantendo a Locaweb **apenas para o e-mail**. Depois disso, um único
`git push` publica tudo — acaba o deploy por FTP.

## Princípios de segurança
- **Não mexer no e-mail.** Os registros **MX** e **TXT (SPF/DKIM)** do domínio continuam
  apontando para a Locaweb. A migração troca só o web (registros A/CNAME).
- **Zero downtime.** Só viramos o DNS depois de testar o site funcionando na Vercel por uma
  URL de preview. O site atual na Locaweb fica no ar até a virada.
- **Rollback fácil.** Se algo der errado, basta reverter o A/CNAME para a Locaweb.

---

## Pré-requisitos
- Conta na Vercel (pode usar login com o GitHub `drmoraes`).
- Acesso ao painel de **DNS do domínio** `entreescolhas.com.br` (onde os registros são
  gerenciados hoje — provavelmente no painel da Locaweb).
- As variáveis de ambiente em mãos (mesmas do `.env.example`).

---

## Passo 1 — Importar o repositório na Vercel
1. Vercel → **Add New → Project → Import Git Repository** → escolha `drmoraes/entreescolhas`.
2. Framework Preset: **Other** (é site estático + funções; não há build).
3. Build Command: deixe **vazio**. Output Directory: deixe **vazio** (raiz).
4. **Não faça deploy ainda** — primeiro configure as variáveis (Passo 2).

## Passo 2 — Variáveis de ambiente (Settings → Environment Variables)
Adicione (Production + Preview), os mesmos valores que já usa hoje:

| Variável | Observação |
|---|---|
| `DATABASE_URL` | string do Supabase (Transaction Pooler) |
| `ADMIN_API_KEY` | chave do Admin |
| `APP_BASE_URL` | `https://www.entreescolhas.com.br` |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` `SMTP_FROM_NAME` | e-mail Locaweb (continua igual) |
| `MP_ACCESS_TOKEN` `MP_PUBLIC_KEY` `MP_REPORT_PRICE` | Mercado Pago |
| `MAX_TEST_ATTEMPTS` | regra do teste |

## Passo 3 — Deploy de preview e TESTES (antes de tocar no DNS)
1. Clique em **Deploy**. A Vercel gera uma URL tipo `entreescolhas-xxxx.vercel.app`.
2. Teste por essa URL (ainda não é o domínio oficial):
   - Páginas: `/`, `/banco-de-talentos.html`, `/portal-rh.html`, `/meu-perfil.html`, `/admin-b2b.html`.
   - API: abrir `/api/stats` ou fazer um cadastro de teste em `/cadastro-teste.html` (deve enviar o e-mail).
   - Portal RH: login demo, busca, desbloqueio, carteira.
3. Só avance quando **tudo** funcionar na URL de preview.

> Dica: rode antes a migração do banco no Supabase (`api/_schema_b2b.sql`) se ainda não rodou,
> senão as rotas B2B dão erro.

## Passo 4 — Adicionar o domínio na Vercel
1. Project → **Settings → Domains → Add** → `www.entreescolhas.com.br` (e também
   `entreescolhas.com.br` para redirecionar o apex para o www).
2. A Vercel vai **mostrar os registros DNS exatos** que você deve criar. Use os valores que
   ela exibir (eles podem mudar). Tipicamente:
   - `www` → **CNAME** → `cname.vercel-dns.com`
   - apex `@` → **A** → o IP que a Vercel indicar (ex.: `76.76.21.21`)

## Passo 5 — Trocar o DNS (no painel da Locaweb)
No gerenciador de DNS do domínio:
1. **Altere apenas** os registros **A (apex)** e **CNAME (www)** para os valores da Vercel.
2. **NÃO altere** os registros **MX** (e-mail) nem **TXT/SPF/DKIM** — eles continuam na Locaweb.
3. Salve. A propagação leva de minutos a algumas horas.

## Passo 6 — Verificar depois da propagação
- Abrir `https://www.entreescolhas.com.br/` e confirmar que é a versão nova (menu não corta,
  contraste melhor — você pode conferir no DevTools se o CSS tem `max-width: 900px`).
- Enviar um e-mail de teste para `suporte@entreescolhas.com.br` e mandar um do sistema
  (cadastro) para confirmar que **o e-mail não quebrou**.
- Testar o checkout do Mercado Pago e os portais B2B no domínio oficial.

---

## Atenção: cron do SLA (plano da Vercel)
O `vercel.json` agenda `/api/cron_sla` de hora em hora (`0 * * * *`). No plano **Hobby** os
crons rodam no máximo **uma vez por dia**. Opções:
- **Vercel Pro** (cron de hora em hora liberado), ou
- mudar o schedule para diário no `vercel.json` (`0 6 * * *`), ou
- chamar `/api/cron_sla` por um agendador externo (ex.: cron-job.org) com o header
  `X-Api-Key: <ADMIN_API_KEY>` na frequência desejada.

## Rollback (se necessário)
Reverta no DNS os registros A/CNAME para os valores antigos da Locaweb. Como o e-mail (MX)
nunca foi alterado, ele permanece intacto o tempo todo.

## Pós-migração (limpeza)
- O deploy por FTP (`deploy.py`) deixa de ser necessário — o deploy passa a ser `git push`.
- A Locaweb fica responsável só pelo **e-mail** (e, se for o caso, registro do domínio).
- Considere, no futuro, migrar o e-mail para Google Workspace/Zoho e sair de vez da Locaweb.
