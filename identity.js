/* Memória local de cadastro — evita pedir nome/e-mail/telefone de novo se a pessoa
   já preencheu em qualquer jornada ou no Banco de Talentos neste navegador.
   Incluir com <script src="/identity.js" defer></script> nas páginas com formulário.
   Uso:
     window.eeIdentity.get()                          -> { nome, email, telefone, tokens, updatedAt } | null
     window.eeIdentity.save({ nome, email, telefone }) -> mescla e persiste
     window.eeIdentity.saveToken(jornada, access)       -> guarda o access_token de uma jornada
     window.eeIdentity.getToken(jornada)                -> access_token salvo (ou null)
     window.eeIdentity.fill(formEl, map)                -> pré-preenche inputs vazios (map: {nome:'#campo-nome', ...}) */
(function () {
  var KEY = 'ee_identity';
  var MAXDAYS = 180;

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.updatedAt) return null;
      if ((Date.now() - data.updatedAt) > MAXDAYS * 864e5) { // expirou
        localStorage.removeItem(KEY);
        return null;
      }
      return data;
    } catch (e) { return null; }
  }

  function write(data) {
    try {
      data.updatedAt = Date.now();
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* localStorage indisponível (modo privado etc.) — segue sem memória */ }
  }

  function get() { return read(); }

  // Mescla campos novos (nome/email/telefone) sem apagar o que já existia.
  // Nunca sobrescreve um valor já salvo com vazio/undefined.
  function save(fields) {
    var cur = read() || { tokens: {} };
    ['nome', 'email', 'telefone'].forEach(function (k) {
      var v = fields && fields[k] != null ? String(fields[k]).trim() : '';
      if (v) cur[k] = v;
    });
    if (!cur.tokens) cur.tokens = {};
    write(cur);
    return cur;
  }

  function saveToken(jornada, access) {
    if (!jornada || !access) return;
    var cur = read() || { tokens: {} };
    if (!cur.tokens) cur.tokens = {};
    cur.tokens[jornada] = access;
    write(cur);
  }

  function getToken(jornada) {
    var cur = read();
    return (cur && cur.tokens && cur.tokens[jornada]) || null;
  }

  // Pré-preenche inputs vazios de um form a partir do que já temos salvo.
  // map = { nome: '#inputNome', email: '#inputEmail', telefone: '#inputTel' }
  // Não sobrescreve campo que o usuário já tiver começado a digitar.
  function fill(map) {
    var cur = read();
    if (!cur) return;
    Object.keys(map || {}).forEach(function (k) {
      var el = document.querySelector(map[k]);
      if (el && !el.value && cur[k]) el.value = cur[k];
    });
  }

  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  window.eeIdentity = { get: get, save: save, saveToken: saveToken, getToken: getToken, fill: fill, clear: clear };
})();
