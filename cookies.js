/* Banner de consentimento de cookies (LGPD).
   Aparece só na 1ª visita; guarda a escolha em localStorage.
   Usa as variáveis de tema (funciona no claro e no escuro). */
(function () {
  var KEY = 'ee-cookie-consent';
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // Já decidiu antes? Não mostra de novo. (window.eeCookieConsent expõe a escolha.)
  window.eeCookieConsent = saved();
  if (window.eeCookieConsent === 'accepted' || window.eeCookieConsent === 'rejected') return;

  function build() {
    if (document.getElementById('ee-cookie-banner')) return;
    var b = document.createElement('div');
    b.id = 'ee-cookie-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Aviso de cookies');
    b.innerHTML =
      '<div class="ee-ck-inner">' +
        '<p class="ee-ck-text">Usamos cookies essenciais para o site funcionar e, com o seu consentimento, para entender o uso e melhorar a sua experiência. ' +
        '<a href="/privacidade.html">Política de Privacidade</a>.</p>' +
        '<div class="ee-ck-actions">' +
          '<button type="button" class="ee-ck-btn ee-ck-reject" id="ee-ck-reject">Rejeitar</button>' +
          '<button type="button" class="ee-ck-btn ee-ck-accept" id="ee-ck-accept">Aceitar</button>' +
        '</div>' +
      '</div>';
    var css = document.createElement('style');
    css.textContent =
      '#ee-cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:9998;padding:14px;' +
        'background:color-mix(in srgb, var(--bg-card, #0F0F1E) 94%, transparent);' +
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
        'border-top:1px solid var(--border, rgba(108,99,255,.15));animation:eeckup .3s ease;}' +
      '@keyframes eeckup{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
      '.ee-ck-inner{max-width:1000px;margin:0 auto;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:0 60px;}' +
      '.ee-ck-text{font-family:inherit;font-size:.86rem;line-height:1.5;color:var(--text-2, #ABA6D4);margin:0;flex:1;min-width:240px;}' +
      '.ee-ck-text a{color:var(--accent, #6C63FF);text-decoration:underline;text-underline-offset:2px;}' +
      '.ee-ck-actions{display:flex;gap:10px;flex-shrink:0;}' +
      '.ee-ck-btn{font-family:inherit;font-size:.86rem;font-weight:600;cursor:pointer;border-radius:10px;padding:10px 20px;border:1px solid var(--border, rgba(108,99,255,.3));transition:transform .15s,border-color .2s,opacity .2s;}' +
      '.ee-ck-reject{background:transparent;color:var(--text-2, #ABA6D4);}' +
      '.ee-ck-reject:hover{border-color:var(--accent, #6C63FF);color:var(--text, #F0EFF8);}' +
      '.ee-ck-accept{background:var(--accent, #6C63FF);color:#fff;border-color:var(--accent, #6C63FF);}' +
      '.ee-ck-accept:hover{transform:translateY(-1px);opacity:.92;}' +
      '@media(max-width:640px){.ee-ck-inner{padding:0 8px;}.ee-ck-actions{width:100%;}.ee-ck-btn{flex:1;}}';
    document.head.appendChild(css);
    document.body.appendChild(b);

    function decide(v) { store(v); window.eeCookieConsent = v; b.style.display = 'none'; }
    document.getElementById('ee-ck-accept').addEventListener('click', function () { decide('accepted'); });
    document.getElementById('ee-ck-reject').addEventListener('click', function () { decide('rejected'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
