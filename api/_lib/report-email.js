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

module.exports = { buildReportEmailHtml };
