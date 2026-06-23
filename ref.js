/* Programa de Afiliados — captura da indicação (first-touch) + faixa de boas-vindas.
   Incluir com <script src="/ref.js" defer></script> nas páginas de entrada. */
(function () {
  var KEY = 'ee_ref';
  var STAMP = 'ee_ref_at';
  var MAXDAYS = 60;

  function getStored() {
    try {
      var at = Number(localStorage.getItem(STAMP) || 0);
      if (at && (Date.now() - at) > MAXDAYS * 864e5) { // expirou
        localStorage.removeItem(KEY); localStorage.removeItem(STAMP); return null;
      }
      return localStorage.getItem(KEY) || null;
    } catch (e) { return null; }
  }

  // Expõe o código para os outros scripts (ex.: cadastro)
  window.eeRef = getStored;

  var url = new URLSearchParams(location.search);
  var incoming = (url.get('ref') || '').trim().toUpperCase().slice(0, 20);

  // first-touch: só grava se ainda não houver um código salvo
  if (incoming && !getStored()) {
    try { localStorage.setItem(KEY, incoming); localStorage.setItem(STAMP, String(Date.now())); } catch (e) {}
  }

  var code = getStored();
  if (!code) return;

  // valida no servidor e mostra a faixa de boas-vindas (transmite confiança e o benefício)
  fetch('/api/b2b?fn=referral&op=resolve&code=' + encodeURIComponent(code))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.valid) {
        try { localStorage.removeItem(KEY); localStorage.removeItem(STAMP); } catch (e) {}
        return;
      }
      if (sessionStorage.getItem('ee_ref_bar') === '1') return; // mostra uma vez por sessão
      var pct = d.discount_pct || 10;
      var quem = d.owner_name ? (' de ' + d.owner_name) : '';
      var bar = document.createElement('div');
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9998;background:linear-gradient(90deg,#6C63FF,#8B7CFF);color:#fff;font:500 0.9rem/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:center;box-shadow:0 -4px 20px rgba(0,0,0,.25)';
      bar.innerHTML = '<span>🎁 Você chegou por uma indicação' + quem + ' e tem <strong>' + pct + '% de desconto</strong> na sua 1ª compra — já aplicado no checkout.</span>'
        + '<button aria-label="Fechar" style="background:rgba(255,255,255,.2);border:0;color:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.85rem">OK</button>';
      bar.querySelector('button').onclick = function () { bar.remove(); try { sessionStorage.setItem('ee_ref_bar', '1'); } catch (e) {} };
      document.body.appendChild(bar);
    })
    .catch(function () {});
})();
