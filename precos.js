/* Preços dinâmicos — fonte única = admin (app_settings), via /api/b2b?fn=public_prices.
   Preenche qualquer elemento com data-preco="single|combo|combo_de|economia".
   Enquanto carrega, mantém o valor que já está no HTML (fallback), então nunca fica vazio. */
(function () {
  function apply(p) {
    if (!p || !p.ok) return;
    var map = {
      single: p.single_fmt,
      combo: p.combo_fmt,
      combo_de: p.combo_de_fmt,
      economia: p.economia_fmt,
    };
    document.querySelectorAll('[data-preco]').forEach(function (el) {
      var k = el.getAttribute('data-preco');
      if (map[k] != null) el.textContent = map[k];
    });
    // permite compor frases: elementos com data-preco-attr="aria-label:combo" etc. (opcional)
  }
  fetch('/api/b2b?fn=public_prices', { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(apply)
    .catch(function () { /* mantém o fallback do HTML */ });
})();
