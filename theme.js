/* ============================================================
   EntreEscolhas — Alternância de tema claro/escuro
   - Aplica o tema salvo ANTES do render (sem flash)
   - Padrão: escuro (respeita preferência salva; 1ª visita segue
     o dark atual do site, mas respeita prefers-color-scheme claro)
   - Injeta um botão flutuante em todas as páginas
   ============================================================ */
(function () {
  var STORAGE_KEY = 'ee-theme';
  var root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
  }

  // Tema inicial: salvo > preferência do SO (claro) > escuro (padrão do site)
  function initialTheme() {
    var s = saved();
    if (s === 'light' || s === 'dark') return s;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  }

  function apply(theme) {
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro');
      btn.title = theme === 'light' ? 'Tema escuro' : 'Tema claro';
    }
  }

  // Aplica imediatamente (documentElement já existe neste ponto)
  apply(initialTheme());

  function current() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function toggle() {
    var next = current() === 'light' ? 'dark' : 'light';
    apply(next);
    store(next);
  }

  function buildButton() {
    if (document.querySelector('.theme-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.innerHTML =
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    btn.addEventListener('click', toggle);
    var navHost = document.querySelector('#nav .nav-inner');
    if (navHost) { btn.classList.add('theme-toggle--nav'); navHost.appendChild(btn); }
    else { document.body.appendChild(btn); }
    apply(current());
  }

  // Ativa transições só depois do 1º paint (evita animação no load)
  function ready() {
    buildButton();
    requestAnimationFrame(function () { root.classList.add('theme-ready'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
