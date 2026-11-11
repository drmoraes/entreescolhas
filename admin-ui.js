/* ============================================================
   EntreEscolhas — utilitários compartilhados das telas novas do Admin
   (Clientes, Cortesias, Configurações). As telas rodam dentro do
   painel.html (iframe) e usam a chave já validada por ele.
   ============================================================ */
const $ = (id) => document.getElementById(id);
let KEY = '';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(s) { return s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; }
function fmtDay(s) { return s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'; }
function fmtYmd(s) { return s ? String(s).slice(0, 10).split('-').reverse().join('/') : ''; }
function brl(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Chamada autenticada à API do Admin. Lança Error com a mensagem do servidor.
function api(path, opts = {}) {
  const headers = { 'X-Api-Key': KEY, ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) };
  return fetch('/api/b2b?' + path, { ...opts, headers }).then(async (r) => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('Erro ' + r.status));
    return d;
  });
}
function post(path, body) { return api(path, { method: 'POST', body: JSON.stringify(body || {}) }); }

// Copia um texto e dá o retorno no próprio botão (sem alert).
function copiar(texto, btn) {
  const fim = (ok) => {
    if (!btn) return;
    const antes = btn.dataset.label || btn.textContent;
    btn.dataset.label = antes;
    btn.textContent = ok ? 'Copiado ✓' : 'Copie manualmente';
    setTimeout(() => { btn.textContent = antes; }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => fim(true), () => { prompt('Copie o link:', texto); fim(false); });
  } else { prompt('Copie o link:', texto); fim(false); }
}

function openDrawer() { $('scrim').classList.add('on'); $('drawer').classList.add('on'); }
function closeDrawer() { $('scrim').classList.remove('on'); $('drawer').classList.remove('on'); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('drawer') && $('drawer').classList.contains('on')) closeDrawer(); });

// Pede ao painel para abrir outra seção (ex.: Clientes → Cortesias já preenchida).
function irPara(tab, params) {
  if (window.parent !== window) window.parent.postMessage({ type: 'ee-admin-go', tab, params: params || null }, location.origin);
  else location.href = '/painel.html#' + tab;
}

function baixarCSV(nome, cols, rows) {
  const q = (v) => { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = [cols.map((c) => q(c[1])).join(',')].concat(rows.map((r) => cols.map((c) => q(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(','))).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Entrada padrão: fora do painel, redireciona para a aba certa; dentro, usa a
// chave guardada e chama o carregamento da tela.
function iniciarAdmin(tab, carregar) {
  try {
    if (window.self === window.top) { location.replace('/painel.html#' + tab); return; }
    KEY = localStorage.getItem('ee_admin_key') || sessionStorage.getItem('ee_admin_key') || '';
  } catch (e) { KEY = ''; }
  if (!KEY) { $('dash').innerHTML = '<p class="note warn" style="margin-top:30px">Sessão do painel não encontrada. Saia e entre de novo.</p>'; return; }
  carregar();
}
