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

// Um bloco do relatório (arquétipo + dimensões + insights) em HTML simples de e-mail.
function blocoHtml(titulo, arch, scores, dimNames) {
  arch = arch || {};
  let dimsHtml = '';
  for (const dim of Object.keys(scores || {})) {
    const label = escapeHtml((dimNames || {})[dim] || dim);
    dimsHtml += `<p>${label}: <strong>${escapeHtml(scores[dim])}/100</strong></p>`;
  }
  let insightsHtml = '';
  for (const insight of (arch.insights || [])) {
    insightsHtml += `<p><strong>${escapeHtml(insight.title || '')}</strong><br>${escapeHtml(insight.text || '')}</p>`;
  }
  return `
      ${titulo ? `<p style="color:#6C63FF;font-weight:bold;text-transform:uppercase;font-size:12px;letter-spacing:.05em;margin:22px 0 2px">${escapeHtml(titulo)}</p>` : ''}
      <h2 style="margin-top:2px">${escapeHtml(arch.name || '')}</h2>
      ${arch.mode ? `<p>${escapeHtml(arch.mode)}</p>` : ''}
      ${arch.desc ? `<p>${escapeHtml(arch.desc)}</p>` : ''}
      ${dimsHtml ? `<h3>Suas dimensões</h3>${dimsHtml}` : ''}
      ${insightsHtml ? `<h3>Insights</h3>${insightsHtml}` : ''}`;
}

// Aceita os dois formatos de relatório salvos pelo teste.html:
//   • jornada simples:   { arch, scores, dimNames }
//   • Perfil Completo:   { perfilCompleto: true, blocos: [{ titulo, arch, scores, dimNames }, …] }
function buildReportEmailHtml(nome, report) {
  report = report || {};
  const perfil = report.perfilCompleto && Array.isArray(report.blocos) && report.blocos.length;
  const corpo = perfil
    ? report.blocos.map((b) => blocoHtml(b.titulo, b.arch, b.scores, b.dimNames)).join('<hr style="border:none;border-top:1px solid #eee;margin:18px 0">')
    : blocoHtml('', report.arch, report.scores, report.dimNames);

  return `
      <p>Olá, ${escapeHtml(nome)}!</p>
      <p>Seu ${perfil ? 'Perfil Completo' : 'relatório completo'} do Entre Escolhas está pronto:</p>
      ${corpo}
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
