# Banco de Talentos B2B — camada de recrutamento

Camada de recrutamento construída **sobre a stack existente** do Entre Escolhas
(site estático + funções serverless Node na Vercel + Postgres/Supabase). Adiciona os
três portais e o núcleo comercial: busca anônima → desbloqueio por crédito →
antifrustração → privacidade by design.

## O que foi entregue

**Portais (frontend)**
- `portal-rh.html` — Portal do RH/Cliente: login/cadastro, busca com filtros e IA de score, cards anônimos, perfil com breakdown dos scores, desbloqueio por crédito com garantia, carteira, convite e disputa.
- `meu-perfil.html` — Portal do Candidato: Score de Confiança, re-confirmação de interesse, controle de visibilidade, convites, consentimento/revogação LGPD.
- `admin-b2b.html` — Admin B2B: KPIs, funil busca→desbloqueio, créditos, qualidade da base, responsividade, risco de privacidade (k-anonimato) e auditoria.

**APIs serverless (`/api`)**
| Rota | Função |
|---|---|
| `rh_login` | Login e cadastro de empresa (trial com 5 créditos bônus) |
| `rh_search` | Busca de candidatos **anônimos** com Aderência + Confiança |
| `rh_candidate` | Perfil anônimo detalhado; revela PII só se já desbloqueado |
| `rh_unlock` | Gasta 1 crédito, valida contato, revela PII, inicia antifrustração |
| `rh_invite` | Envia convite e inicia o SLA de 7 dias |
| `rh_dispute` | Abre disputa; reembolso automático nos casos elegíveis |
| `rh_wallet` | Saldo, extrato, estatísticas e compra de pacotes |
| `cand_portal` | Autoatendimento do candidato (token privado) |
| `admin_b2b_stats` | KPIs e auditoria (protegido por `ADMIN_API_KEY`) |
| `cron_sla` | Varredura horária: estorno por sem-resposta + rebaixar perfis frios |

**Núcleo (`/api/_lib`)**
- `anonymize.js` — Identity Vault: separa PII de dados exibíveis, generaliza quase-identificadores.
- `scoring.js` — Score de Aderência (fit) e Score de Confiança/Responsividade, **explicáveis** e sem atributos sensíveis.
- `b2b-auth.js` — hash de senha (pbkdf2), sessão, razão de créditos e log de auditoria.

## Setup

1. **Banco** — no SQL Editor do Supabase, rode na ordem:
   ```
   api/_schema.sql        (já existente)
   api/_schema_b2b.sql    (novo — empresas, créditos, desbloqueios, auditoria, colunas B2B)
   ```
2. **Variáveis de ambiente** (Vercel → Settings → Environment Variables): já cobertas pelo
   `.env.example` atual (`DATABASE_URL`, `ADMIN_API_KEY`, SMTP, Mercado Pago).
3. **Dados de demonstração**:
   ```bash
   DATABASE_URL=... node scripts/seed_b2b.js
   ```
   Cria a empresa demo (**demo@empresa.com / demo1234**, 20 créditos) e ~40 candidatos
   consentidos. Imprime um token de candidato para testar `meu-perfil.html`.
4. **Deploy** — `git push` (Vercel) ou o fluxo de deploy atual do projeto. O `vercel.json`
   já registra o cron horário de SLA.

## Como testar localmente o fluxo

```bash
# instala a dependência de teste (Postgres em memória)
npm install --no-save pg-mem
node tests/flow.test.js
```
Cobre 27 asserções: busca sem vazamento de PII, ordenação por aderência, desbloqueio com
débito de crédito, bloqueio de duplicado, estorno automático por contato inválido,
SLA do convite, resposta do candidato, revogação de consentimento (saída imediata da base),
extrato da carteira e log imutável de `reveal_pii`.

## Privacidade & segurança (LGPD by design)

- **PII nunca sai antes do desbloqueio.** `rh_search`/`rh_candidate` só servem o DTO anônimo; a revelação ocorre exclusivamente em `rh_unlock`, com gasto de crédito e log.
- **Pseudônimo opaco** (`public_token`) é a única referência exposta ao RH. O candidato usa um token **privado** separado (`confirm_token`) no autoatendimento — o RH não consegue agir pelo candidato.
- **Auditoria imutável**: `access_logs` é append-only (trigger bloqueia UPDATE/DELETE).
- **Antifrustração**: estorno automático por contato inválido (no ato) e por sem-resposta no SLA (cron); reembolso por candidato fora do mercado/desatualizado; rebaixamento de perfis frios.
- **k-anonimato**: o Admin monitora células (área+senioridade+cidade) com menos de 5 perfis (risco de reidentificação).
- **Scores sem viés**: nenhum atributo sensível (idade, gênero, PCD) entra no ranking; cada score expõe o “porquê”.

## Pendências para produção (próximos passos)

- Integração real do checkout (Mercado Pago) para `rh_wallet` — hoje credita direto sem `MP_ACCESS_TOKEN` (modo dev).
- Envio real de e-mail/WhatsApp no convite (reaproveitar `_lib/mailer`).
- Verificação de contato via double opt-in / OTP de telefone para alimentar `email_verified`/`phone_verified`.
- Criptografia de coluna para CPF (envelope/KMS) quando o campo for adicionado.
