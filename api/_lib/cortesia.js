// ─────────────────────────────────────────────────────────────
// Cortesias (teste 100% grátis) — regra única, usada pelo paywall público
// (cortesia_unlock / lead_status) e pelo Admin (admin_cortesias).
//
// Dois tipos, na MESMA tabela `cortesias`:
//   • pessoa — vinculada a um e-mail. A pessoa faz o cadastro e o teste como
//     qualquer cliente; no paywall o relatório é liberado de graça. Vale mesmo
//     sem o código (o e-mail cadastrado é o que identifica).
//   • link   — código compartilhável (?cortesia=CODIGO), com validade e limite.
//
// Cada liberação fica registrada em `cortesia_usos` (quem, qual teste, quando).
// Compatibilidade: códigos antigos guardados em app_settings (`cortesia_config`
// e `cortesia_codes`) continuam valendo até serem importados para a tabela.
// ─────────────────────────────────────────────────────────────
const crypto = require('crypto');
const { query } = require('./db');
const { getSetting, setSetting } = require('./settings');

const JORNADAS = ['perfil', 'arquetipo', 'fit-cultural', 'scanner', 'bussola'];
const JORNADA_LABEL = {
  perfil: 'Perfil Completo',
  arquetipo: 'Jeito de decidir (Arquétipo)',
  'fit-cultural': 'Ambiente Ideal (Fit Cultural)',
  scanner: 'Scanner de Relacionamento',
  bussola: 'Bússola Vocacional',
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS cortesias (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(10) NOT NULL DEFAULT 'pessoa',
    code VARCHAR(40) NOT NULL UNIQUE,
    nome VARCHAR(160),
    email VARCHAR(255),
    empresa VARCHAR(160),
    jornadas VARCHAR(120) NOT NULL DEFAULT '',
    motivo VARCHAR(200),
    max_uses INTEGER NOT NULL DEFAULT 0,
    uses INTEGER NOT NULL DEFAULT 0,
    expires VARCHAR(10) NOT NULL DEFAULT '',
    status VARCHAR(12) NOT NULL DEFAULT 'ativa',
    created_by VARCHAR(120),
    invite_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW())`,
  'CREATE INDEX IF NOT EXISTS idx_cortesias_email ON cortesias (email)',
  `CREATE TABLE IF NOT EXISTS cortesia_usos (
    id SERIAL PRIMARY KEY,
    cortesia_id INTEGER,
    lead_id INTEGER,
    email VARCHAR(255),
    jornada VARCHAR(40),
    origem VARCHAR(20) NOT NULL DEFAULT 'cortesia',
    actor VARCHAR(120),
    created_at TIMESTAMPTZ DEFAULT NOW())`,
  'CREATE INDEX IF NOT EXISTS idx_cortesia_usos_cortesia ON cortesia_usos (cortesia_id)',
  'CREATE INDEX IF NOT EXISTS idx_cortesia_usos_lead ON cortesia_usos (lead_id)',
];

let schemaReady = false;
// Cria as tabelas se ainda não existirem (idempotente). Chamado pelo Admin —
// assim não há passo manual de migração para começar a usar.
async function ensureSchema() {
  if (schemaReady) return;
  for (const sql of SCHEMA) await query(sql);
  schemaReady = true;
}

function today() { return new Date().toISOString().slice(0, 10); } // YYYY-MM-DD (UTC)
function normCode(s) { return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40); }
function normEmail(s) { return String(s || '').trim().toLowerCase(); }
function genCode(prefix) {
  // sem caracteres ambíguos (0/O, 1/I) — o código pode ser ditado ou digitado
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[bytes[i] % abc.length];
  return (prefix || 'CORT') + '-' + s;
}

// "perfil,fit-cultural" → ['perfil','fit-cultural'] ; '' → [] (= todas)
function parseJornadas(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  const out = [];
  for (const j of arr) {
    const k = String(j || '').trim();
    if (JORNADAS.includes(k) && !out.includes(k)) out.push(k);
  }
  return out.length === JORNADAS.length ? [] : out;
}

// Estado exibível de uma cortesia (não altera o banco).
function estadoDe(c, hoje = today()) {
  if (c.status !== 'ativa') return 'revogada';
  if (c.expires && String(c.expires).slice(0, 10) < hoje) return 'expirada';
  const max = parseInt(c.max_uses, 10) || 0;
  if (max > 0 && (parseInt(c.uses, 10) || 0) >= max) return 'esgotada';
  return 'ativa';
}

// Regra de validade. Devolve null se pode usar; senão, a mensagem para a pessoa.
function motivoRecusa(c, { email, jornada }, hoje = today()) {
  const est = estadoDe(c, hoje);
  if (est === 'revogada') return 'Esta cortesia não está mais ativa.';
  if (est === 'expirada') return 'Este link de cortesia expirou.';
  if (est === 'esgotada') return 'Este link de cortesia atingiu o limite de usos.';
  const js = parseJornadas(c.jornadas);
  if (js.length && jornada && !js.includes(jornada)) return 'Esta cortesia não vale para este teste.';
  if (c.email && normEmail(c.email) !== normEmail(email)) {
    return 'Esta cortesia é pessoal e está vinculada a outro e-mail. Faça o cadastro com o e-mail que recebeu o convite.';
  }
  return null;
}

function loadLegacyConfig(raw) {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function parseLegacyList(raw) {
  return String(raw || '').split(/[,\n;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
}

// Descobre qual cortesia (se houver) libera este lead neste teste.
// Ordem: código informado → cortesia pessoal pelo e-mail → códigos legados.
// Devolve { ok, entry?, legacy?, code?, error? } — NÃO consome o uso.
async function resolveCortesia({ code, email, jornada }) {
  const cod = normCode(code);
  let erro = null;

  let tabelaOk = true;
  if (cod) {
    try {
      const { rows } = await query('SELECT * FROM cortesias WHERE code = $1', [cod]);
      if (rows[0]) {
        const m = motivoRecusa(rows[0], { email, jornada });
        if (!m) return { ok: true, entry: rows[0], code: rows[0].code };
        erro = m;
      }
    } catch (e) { tabelaOk = false; /* tabela ainda não criada → segue p/ legado */ }
  }

  if (tabelaOk && email) {
    try {
      const { rows } = await query(
        "SELECT * FROM cortesias WHERE email = $1 AND status = 'ativa' ORDER BY id DESC", [normEmail(email)]);
      for (const c of rows) {
        if (!motivoRecusa(c, { email, jornada })) return { ok: true, entry: c, code: c.code };
      }
    } catch (e) { /* idem */ }
  }

  if (cod && !erro) {
    const config = loadLegacyConfig(await getSetting('cortesia_config', '[]'));
    const simple = parseLegacyList(await getSetting('cortesia_codes', ''));
    const entry = config.find((c) => String(c.code || '').trim().toUpperCase() === cod);
    if (entry) {
      if (entry.expires && String(entry.expires).slice(0, 10) < today()) erro = 'Este link de cortesia expirou.';
      else {
        const max = parseInt(entry.max_uses, 10) || 0;
        if (max > 0 && (parseInt(entry.uses, 10) || 0) >= max) erro = 'Este link de cortesia atingiu o limite de usos.';
        else return { ok: true, legacy: { config, entry }, code: cod };
      }
    } else if (simple.includes(cod)) {
      return { ok: true, legacy: {}, code: cod };
    }
  }

  return { ok: false, error: erro || (cod ? 'Código de cortesia inválido ou expirado.' : 'Nenhuma cortesia disponível para este cadastro.') };
}

// Consome 1 uso de forma atômica (respeita o limite mesmo com cliques simultâneos).
async function consumirUso(res) {
  if (res.entry) {
    const r = await query(
      'UPDATE cortesias SET uses = uses + 1 WHERE id = $1 AND (max_uses = 0 OR uses < max_uses) RETURNING id',
      [res.entry.id]);
    return r.rows.length > 0;
  }
  if (res.legacy && res.legacy.entry) {
    try {
      res.legacy.entry.uses = (parseInt(res.legacy.entry.uses, 10) || 0) + 1;
      await setSetting('cortesia_config', JSON.stringify(res.legacy.config));
    } catch (e) { /* contador legado é best-effort */ }
  }
  return true;
}
async function devolverUso(res) {
  if (!res.entry) return;
  try { await query('UPDATE cortesias SET uses = uses - 1 WHERE id = $1 AND uses > 0', [res.entry.id]); } catch (e) {}
}

// Registro de quem usou (best-effort — nunca bloqueia a liberação).
async function registrarUso({ cortesiaId, lead, origem, actor }) {
  try {
    await query(
      'INSERT INTO cortesia_usos (cortesia_id, lead_id, email, jornada, origem, actor) VALUES ($1,$2,$3,$4,$5,$6)',
      [cortesiaId || null, lead.id, normEmail(lead.email), lead.jornada || null, origem || 'cortesia', actor || null]);
  } catch (e) { /* tabela pode não existir ainda */ }
}

// Traz para a tabela os códigos antigos guardados em app_settings e limpa as
// settings (a tabela passa a ser a fonte única — revogar no Admin revoga de fato).
async function importarLegado(actorNome) {
  const config = loadLegacyConfig(await getSetting('cortesia_config', '[]'));
  const simple = parseLegacyList(await getSetting('cortesia_codes', ''));
  if (!config.length && !simple.length) return 0;
  let n = 0;
  const vistos = new Set();
  const itens = config.map((c) => ({
    code: normCode(c.code), expires: /^\d{4}-\d{2}-\d{2}$/.test(String(c.expires || '')) ? c.expires : '',
    max_uses: Math.max(0, parseInt(c.max_uses, 10) || 0), uses: Math.max(0, parseInt(c.uses, 10) || 0),
  })).concat(simple.map((s) => ({ code: normCode(s), expires: '', max_uses: 0, uses: 0 })));
  for (const it of itens) {
    if (!it.code || vistos.has(it.code)) continue;
    vistos.add(it.code);
    const ja = await query('SELECT id FROM cortesias WHERE code = $1', [it.code]);
    if (ja.rows[0]) continue;
    await query(
      `INSERT INTO cortesias (tipo, code, jornadas, motivo, max_uses, uses, expires, created_by)
       VALUES ('link', $1, '', 'Importado dos links antigos', $2, $3, $4, $5)`,
      [it.code, it.max_uses, it.uses, it.expires, actorNome || 'sistema']);
    n++;
  }
  await setSetting('cortesia_config', '[]');
  await setSetting('cortesia_codes', '');
  return n;
}

// De onde veio a liberação de um lead pago (para as telas de Testes/Clientes).
function origemLiberacao(l) {
  if (l.payment_status !== 'paid') return null;
  const mp = String(l.mp_payment_id || '');
  if (mp.startsWith('cortesia')) return 'cortesia';
  if (mp === 'free') return 'gratis';
  return 'pago';
}

module.exports = {
  JORNADAS, JORNADA_LABEL, SCHEMA,
  ensureSchema, today, normCode, normEmail, genCode, parseJornadas,
  estadoDe, motivoRecusa, resolveCortesia, consumirUso, devolverUso,
  registrarUso, importarLegado, origemLiberacao,
};
