# Plano técnico — Preço, Combo, Indicação e Cashback

Decisões aprovadas: **nível único** · **Pix em fila manual no admin** · **cashback liberado após 8 dias** · entregar **plano + termos + schema antes de mexer no checkout**.

## Como o sistema funciona hoje (resumo)

- Site estático (HTML) + funções serverless na Vercel (`/api/*.js`) + Postgres (Neon em prod).
- Cada teste é uma **jornada** (`arquetipo`, `fit-cultural`, `scanner-relacionamento`, `bussola-vocacional`).
- Tabela `leads` é única por `(email, jornada)`. O pagamento é **por jornada**: `leads.payment_status='paid'`.
- Preço fica em `app_settings.report_price` (hoje R$7,97), lido por `api/_lib/settings.js`.
- Pagamento via Mercado Pago: `mp_create_preference.js` (Checkout Pro) e `_mp_process_payment.js` (Pix/cartão transparente). Confirmação real vem pelo `mp_webhook.js`.
- **Não existe** carrinho, combo nem indicação hoje.

## Mudança conceitual central

Introduzir a tabela **`purchases`** como registro de pedido. Ela passa a ser a fonte da verdade do que foi pago e desbloqueia o acesso:

- `kind='single'` + `jornada=X` → libera a jornada X.
- `kind='combo'` → libera **todas** as jornadas daquele e-mail.

`leads.payment_status` continua sendo atualizado (compatibilidade), mas o acesso passa a checar `purchases`. O cashback se vincula a uma **compra paga**, não a um lead.

---

## Fase 1 — Preço e Combo (R$9,90 avulso / R$19,90 combo)

1. **Settings:** adicionar `price_single=9.90` e `price_combo=19.90` em `app_settings` (já no `schema_cashback.sql`). Em `_lib/settings.js`, criar `getPriceSingle()` e `getPriceCombo()`; manter `getReportPrice()` como alias de single para compatibilidade.
2. **Admin settings** (`api/_admin_settings.js` + `admin.html`): expor os dois campos de preço (hoje só existe `report_price`). Validação 0,01–999.
3. **Checkout backend:**
   - `mp_create_preference.js` e `_mp_process_payment.js` passam a aceitar `kind` (`single|combo`). O `unit_price`/`transaction_amount` vem de `getPriceSingle()`/`getPriceCombo()` — **nunca** do front (evita adulteração de preço).
   - Criar registro em `purchases` (status `pending`) no início do checkout, com `kind`, `jornada`, `amount`, `referred_by_code`, `coupon_code`.
4. **Webhook** (`mp_webhook.js`): ao aprovar, marcar `purchases.status='paid'`, `paid_at=NOW()`; se `combo`, o acesso a todas as jornadas decorre da própria linha combo. Disparar criação do cashback (Fase 3).
5. **Front (`teste.html`)** — **o "carrinho"/combo e a garantia do desconto:**
   - No paywall, oferecer dois botões: **"Este teste — R$9,90"** e **"Todos os testes (combo) — R$19,90"** com selo de economia.
   - O valor exibido vem de um endpoint de preços (`/api/prices`) que lê `app_settings` — fonte única, então o preço na tela e o cobrado são sempre iguais.
   - O desconto do combo é **estrutural** (é um preço próprio, não um cupom somado), então não há risco de "desconto não aplicado": o backend cobra `price_combo` direto. Cupom, se existir, incide sobre esse valor e é validado no servidor.
   - Atualizar textos fixos "R$ 7,97" (meta tags, badges, paywall) → novos preços. Ocorrências mapeadas em: `teste.html`, `index.html`, `fit-cultural.html`, `scanner-relacionamento.html`, `bussola-vocacional.html`, `banco-de-talentos.html`, `termos.html`, `admin-b2b.html`.
6. **Acesso pós-combo:** ajustar a checagem de "pago" para consultar `purchases` (combo libera todas as jornadas do e-mail).

**Garantia do desconto no carrinho (resumo):** preço único vindo do servidor + combo como SKU de preço próprio + recálculo no backend no momento do pagamento. O front nunca define o valor.

## Fase 2 — Captura da indicação

1. **Código por pessoa:** ao concluir um teste (ou no `obrigado.html`), gerar/buscar `referral_codes` para aquele e-mail e mostrar o link: `https://entreescolhas.com/?ref=CODE`.
2. **Atribuição:** qualquer página de entrada lê `?ref=CODE`, grava em cookie/localStorage; no `lead_register.js`, persistir `leads.referred_by_code`. Regras: ignora autoindicação (mesmo e-mail), respeita o primeiro código (first-touch) ou o último (last-touch) — **definir** (sugiro first-touch).
3. **Compartilhamento:** botões de WhatsApp/copiar link no `obrigado.html` e no `meu-perfil.html`.

## Fase 3 — Geração e liberação do cashback

1. **Na aprovação da compra** (webhook): se a compra tem `referred_by_code` válido e não é autoindicação, inserir linha em `cashback_ledger`:
   - `cashback_pct` = `app_settings.cashback_pct` (snapshot), `cashback_amount = amount * pct/100`.
   - `paid_purchase_at = NOW()`, `release_at = NOW() + cashback_window_days` (8 dias), status `pending`.
2. **Cron diário** (novo `api/_cron_cashback.js`, ou estender `_cron_cart.js`): `UPDATE cashback_ledger SET status='released' WHERE status='pending' AND release_at <= NOW()`.
3. **Estorno/reembolso:** no webhook, se `payment.status` virar `refunded/charged_back` dentro da janela → `purchases.status='refunded'` e `cashback_ledger.status='cancelled'` (cancel_reason).
4. **Aceite obrigatório:** o cashback só é pago a indicador que tem registro em `cashback_terms_accept`. Coletar o aceite no momento de pegar o link de indicação ou no saque.

## Fase 4 — Painel admin (owner/admin)

Nova aba **"Indicações & Cashback"** (`admin-cashback.html` + `api/_admin_cashback.js`), com permissão via `adminCan(role,'coupons')` (perfil financeiro/owner), no padrão dos outros admins:

- **Tabela de indicações:** quem indicou (e-mail/código), quem comprou, valor da compra, **% (20%)**, valor do cashback, status (pendente/liberado/pago/cancelado), data de liberação.
- **Fila de pagamento Pix:** agrupar cashbacks `released` por indicador → mostrar nome, CPF, chave Pix e total a pagar. Botão **"Marcar como pago"** (cria `cashback_payouts`, status `paid`, grava `paid_by` e comprovante).
- **Respeito ao CDC:** itens só aparecem como "a pagar" depois dos 8 dias; itens estornados aparecem como cancelados.
- **Auditoria:** toda ação usa `logAdmin` (já existe).
- **Export CSV** da fila (reaproveitar padrão de `api/export.js`).

## Fase 5 — Jurídico e conformidade

1. Publicar `regulamento-cashback.html` (a partir do `REGULAMENTO-CASHBACK.md`) no padrão visual de `termos.html`/`privacidade.html`.
2. Checkbox de aceite com link, gravando em `cashback_terms_accept` (versão + IP + data).
3. Atualizar `termos.html` e `privacidade.html` com referência ao programa e ao tratamento de CPF/chave Pix.
4. **Revisão por advogado** antes de ir ao ar (tributação do cashback + Lei 1.521/51).

---

## Ordem de execução sugerida

| Etapa | Entrega | Risco |
|---|---|---|
| 0 | Rodar `schema_cashback.sql` no Neon | baixo (idempotente) |
| 1 | Preço + combo + ajuste de acesso | **médio (mexe no checkout em prod)** |
| 2 | Captura de indicação | baixo |
| 3 | Cashback (geração/liberação/cron) | médio |
| 4 | Admin de cashback + fila Pix | baixo |
| 5 | Página do regulamento + aceite | baixo |

## Pontos que ainda precisam da sua definição

1. **Atribuição:** first-touch (primeiro link que trouxe a pessoa) ou last-touch? — sugiro **first-touch**.
2. **Valor mínimo de saque** e **prazo de pagamento do Pix** (deixei placeholders R$20 / 15 dias úteis no regulamento).
3. **Combo e acesso:** o combo libera as 4 jornadas atuais e também as futuras? — sugiro **sim, todas inclusive futuras**.
4. **Dados da empresa** para o regulamento (razão social, CNPJ, comarca do foro).
5. **Tributação do cashback:** confirmar tratamento com contador antes de publicar.
