// Monta o HTML do e-mail de convite enviado ao candidato quando uma empresa
// o desbloqueia e convida. Mantém a identidade da empresa neutra até a resposta
// (coerente com o portal do candidato) e leva ao "Responder" do meu-perfil.html.
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// nome: nome do candidato · recruiterMessage: texto livre do RH (opcional) · link: URL do portal
function buildInviteEmailHtml(nome, recruiterMessage, link, slaDays = 7) {
  const msg = String(recruiterMessage || '').trim();
  const msgBlock = msg
    ? `<tr><td style="padding:16px 0">
         <div style="background:#F4F2FF;border-left:4px solid #6C63FF;border-radius:8px;padding:14px 16px;color:#33305A;font-size:15px;line-height:1.55">
           ${escapeHtml(msg).replace(/\n/g, '<br>')}
         </div></td></tr>`
    : '';

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2A2740">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 0 4px">
        <span style="font-weight:800;font-size:18px;color:#16142B">Entre<span style="color:#6C63FF">Escolhas</span></span>
        <span style="color:#8E8AB5;font-size:13px"> · Banco de Talentos</span>
      </td></tr>
      <tr><td style="padding:18px 0 6px">
        <h1 style="font-size:21px;margin:0;color:#16142B">Olá, ${escapeHtml(nome || 'tudo bem')}! 👋</h1>
      </td></tr>
      <tr><td style="font-size:15px;line-height:1.6;color:#444066;padding:6px 0">
        Uma empresa parceira encontrou o seu perfil no Banco de Talentos e
        <strong>gostaria de conversar sobre uma oportunidade</strong>.
      </td></tr>
      ${msgBlock}
      <tr><td style="padding:20px 0 8px">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#6C63FF;color:#fff;
          text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px">
          Ver convite e responder
        </a>
      </td></tr>
      <tr><td style="font-size:13px;line-height:1.6;color:#8E8AB5;padding:8px 0">
        Responder em até <strong>${slaDays} dias</strong> mantém seu selo “Ativo” e mostra às empresas
        que você está disponível. Se preferir, você pode ajustar sua visibilidade ou sair do banco a qualquer momento no seu perfil.
      </td></tr>
      <tr><td style="border-top:1px solid #ECEAF6;padding:16px 0 0;font-size:12px;color:#A9A6C4;line-height:1.6">
        Você recebe este e-mail porque consentiu em participar do Banco de Talentos do Entre Escolhas.
        Para revogar o consentimento, acesse seu perfil pelo botão acima.
      </td></tr>
    </table>
  </div>`;
}

module.exports = { buildInviteEmailHtml };
