// Monta o HTML do e-mail de relatório completo (porte de buildReportEmailHtml,
// que existia duplicado em lead_save_report.php e mp_webhook.php).
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReportEmailHtml(nome, report) {
  const arch = report.arch || {};
  const name = escapeHtml(arch.name || '');
  const mode = escapeHtml(arch.mode || '');
  const desc = escapeHtml(arch.desc || '');

  let dimsHtml = '';
  const scores = report.scores || {};
  const dimNames = report.dimNames || {};
  for (const dim of Object.keys(scores)) {
    const label = escapeHtml(dimNames[dim] || dim);
    dimsHtml += `<p>${label}: <strong>${scores[dim]}/100</strong></p>`;
  }

  let insightsHtml = '';
  for (const insight of (arch.insights || [])) {
    const title = escapeHtml(insight.title || '');
    const text = escapeHtml(insight.text || '');
    insightsHtml += `<p><strong>${title}</strong><br>${text}</p>`;
  }

  return `
      <p>Olá, ${escapeHtml(nome)}!</p>
      <p>Seu relatório completo do Entre Escolhas está pronto:</p>
      <h2>${name}</h2>
      <p>${mode}</p>
      <p>${desc}</p>
      <h3>Suas dimensões</h3>
      ${dimsHtml}
      <h3>Insights</h3>
      ${insightsHtml}
      <p>Você pode acessar este relatório novamente a qualquer momento pelo link enviado no e-mail de confirmação.</p>
    `;
}

// Envia o relatório e marca report_sent_at em caso de sucesso. Em caso de FALHA,
// não bloqueia a liberação (o usuário já vê o relatório na tela), mas registra o
// erro de forma VISÍVEL: log no servidor (Vercel) + última falha em app_settings
// (`last_report_email_error`) e contador (`report_email_failures`) para o admin.
// Recebe {query, mailer, setSetting, getSetting} por injeção (evita ciclo de imports).
async function sendReportAndMark(deps, lead) {
  const { query, mailer, setSetting, getSetting } = deps;
  try {
    const html = buildReportEmailHtml(lead.nome, lead.report_json);
    const ok = await mailer.send(lead.email, 'Seu relatório completo — Entre Escolhas', html);
    if (ok) {
      await query('UPDATE leads SET report_sent_at = NOW() WHERE id = $1', [lead.id]);
      return { ok: true };
    }
    const msg = (mailer.getLastError && mailer.getLastError()) || 'envio retornou falso';
    console.error('[report-email] FALHA ao enviar para', lead.email, '-', msg);
    try {
      if (setSetting) await setSetting('last_report_email_error', new Date().toISOString() + ' · ' + lead.email + ' · ' + String(msg).slice(0, 160));
      if (setSetting && getSetting) {
        const n = (parseInt(await getSetting('report_email_failures', '0'), 10) || 0) + 1;
        await setSetting('report_email_failures', String(n));
      }
    } catch (e2) { /* registro é best-effort */ }
    return { ok: false, error: msg };
  } catch (e) {
    console.error('[report-email] ERRO ao enviar para', lead && lead.email, '-', e && e.message);
    try { if (setSetting) await setSetting('last_report_email_error', new Date().toISOString() + ' · ' + (lead && lead.email) + ' · ' + (e && e.message)); } catch (e2) {}
    return { ok: false, error: e && e.message };
  }
}

module.exports = { buildReportEmailHtml, sendReportAndMark };
