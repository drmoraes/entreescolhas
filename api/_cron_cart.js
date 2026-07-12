// GET/POST /api/b2b?fn=cron_cart — recuperação de carrinho do candidato.
// Acha quem concluiu o teste, NÃO pagou e ainda não recebeu o lembrete, e envia
// 1 e-mail com o link pra retomar e desbloquear o relatório (R$ 7,97).
// Roda via Vercel Cron (header) ou manualmente com ADMIN_API_KEY.
const { setCors, json, err } = require('./_lib/http');
const { query } = require('./_lib/db');
const mailer = require('./_lib/mailer');
const { getReportPrice } = require('./_lib/settings');

const JLABEL = { arquetipo: 'Arquétipo', bussola: 'Bússola Vocacional', 'fit-cultural': 'Ambiente Ideal', scanner: 'Scanner de Relacionamento', perfil: 'Perfil Completo' };
function esc(s){ return String(s==null?'':s).replace(/[<>&]/g,''); }

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  const isCron = req.headers['x-vercel-cron'] || req.headers['x-vercel-signature'];
  if (!isCron) {
    const { requireApiKey } = require('./_lib/http');
    if (!(await requireApiKey(req, res))) return;
  }

  const base = process.env.APP_BASE_URL || 'https://www.entreescolhas.com.br';
  const preco = (await getReportPrice()).toFixed(2).replace('.', ',');

  // candidatos que concluíram (têm relatório), não pagaram, sem lembrete ainda,
  // e que terminaram entre 2h e 7 dias atrás (dá tempo de pagar; não pega antigos demais).
  const { rows } = await query(`
    SELECT id, nome, email, jornada, access_token
      FROM leads
     WHERE payment_status = 'pending'
       AND report_json IS NOT NULL
       AND confirmed_at IS NOT NULL
       AND cart_recovery_at IS NULL
       AND updated_at <= NOW() - INTERVAL '2 hours'
       AND updated_at >= NOW() - INTERVAL '7 days'
     ORDER BY updated_at DESC
     LIMIT 200`);

  let enviados = 0, falhas = 0;
  for (const l of rows) {
    const link = `${base}/teste.html?jornada=${encodeURIComponent(l.jornada)}&access=${encodeURIComponent(l.access_token)}`;
    const html = `
      <p>Olá, ${esc(l.nome)}!</p>
      <p>Você concluiu sua análise de <strong>${JLABEL[l.jornada] || l.jornada}</strong> no Entre Escolhas, mas o relatório completo ainda está esperando por você.</p>
      <p>São páginas com suas dimensões e insights detalhados — por apenas <strong>R$ ${preco}</strong>.</p>
      <p><a href="${link}" style="display:inline-block;background:#6C63FF;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700">Desbloquear meu relatório</a></p>
      <p style="color:#888;font-size:12px">Se você já pagou, pode ignorar este e-mail. — Entre Escolhas</p>`;
    try {
      const ok = await mailer.send(l.email, 'Seu relatório completo está esperando — Entre Escolhas', html);
      if (ok) { enviados++; await query('UPDATE leads SET cart_recovery_at = NOW() WHERE id = $1', [l.id]); }
      else falhas++;
    } catch (e) { falhas++; }
  }

  return json(res, { ok: true, candidatos: rows.length, enviados, falhas });
};
