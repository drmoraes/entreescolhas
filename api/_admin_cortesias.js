// /api/b2b?fn=admin_cortesias&op=list|create|toggle|resend|usos
// Central de CORTESIAS (teste 100% grátis) do Admin. Um lugar só para:
//   • liberar o teste completo para uma pessoa (por e-mail) — ela vive a
//     experiência inteira do site e, no paywall, o relatório sai de graça;
//   • criar links de cortesia compartilháveis (código, validade, limite);
//   • ver quem usou cada cortesia e todas as liberações gratuitas já feitas.
// Protegido por ADMIN_API_KEY / token de usuário interno (capacidade 'cortesias').
const { setCors, json, err, requireApiKey, logAdmin, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { getSetting } = require('./_lib/settings');
const { adminCan } = require('./_lib/admin-perms');
const mailer = require('./_lib/mailer');
const C = require('./_lib/cortesia');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function baseUrl() { return String(process.env.APP_BASE_URL || 'https://www.entreescolhas.com.br').replace(/\/+$/, ''); }

// Links prontos (um por teste liberado). Vazio em `jornadas` = todos os testes.
function linksDe(c) {
  const js = C.parseJornadas(c.jornadas);
  const lista = js.length ? js : C.JORNADAS;
  return lista.map((j) => ({
    jornada: j, label: C.JORNADA_LABEL[j] || j,
    url: `${baseUrl()}/teste.html?jornada=${encodeURIComponent(j)}&cortesia=${encodeURIComponent(c.code)}`,
  }));
}

function view(c) {
  return {
    id: c.id, tipo: c.tipo, code: c.code, nome: c.nome, email: c.email, empresa: c.empresa,
    jornadas: C.parseJornadas(c.jornadas), motivo: c.motivo,
    max_uses: Number(c.max_uses) || 0, uses: Number(c.uses) || 0, expires: c.expires || '',
    status: c.status, estado: C.estadoDe(c), created_by: c.created_by,
    invite_sent_at: c.invite_sent_at, created_at: c.created_at, links: linksDe(c),
  };
}

function conviteHtml(c) {
  const links = linksDe(c);
  const itens = links.map((l) =>
    `<p style="margin:10px 0"><a href="${l.url}" style="background:#6C63FF;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:bold;display:inline-block">Fazer o teste: ${esc(l.label)}</a></p>`).join('');
  const validade = c.expires ? `<p>Este acesso vale até <strong>${esc(String(c.expires).split('-').reverse().join('/'))}</strong>.</p>` : '';
  return `
    <p>Olá${c.nome ? ', ' + esc(c.nome) : ''}!</p>
    <p>Você recebeu um <strong>acesso cortesia</strong> ao Entre Escolhas — a experiência completa, sem custo.</p>
    ${itens}
    <p><strong>Como funciona</strong></p>
    <ol>
      <li>Faça o cadastro com <strong>este e-mail</strong> (${esc(c.email)}) — é ele que identifica a sua cortesia.</li>
      <li>Responda às situações do teste (leva em torno de 10 minutos).</li>
      <li>No final, clique em <strong>“Liberar meu relatório grátis”</strong> para ver o relatório completo. Ele também chega neste e-mail.</li>
    </ol>
    ${validade}
    <p>Qualquer dúvida, é só responder a este e-mail.</p>
    <p>— Equipe Entre Escolhas</p>`;
}

async function enviarConvite(c) {
  if (!c.email) return false;
  const ok = await mailer.send(c.email, 'Seu acesso cortesia ao Entre Escolhas', conviteHtml(c));
  if (ok) { try { await query('UPDATE cortesias SET invite_sent_at = NOW() WHERE id = $1', [c.id]); } catch (e) {} }
  return ok;
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const op = String((req.query && req.query.op) || 'list');
  const actor = req.actor || {};
  const podeEditar = adminCan(actor.role, 'cortesias');

  await C.ensureSchema();

  // ── LISTAR (cortesias + liberações gratuitas + resumo) ───
  if (op === 'list') {
    // Na primeira abertura, traz os códigos antigos (app_settings) para a tabela.
    let importados = 0;
    if (podeEditar) { try { importados = await C.importarLegado(actor.nome); } catch (e) { /* segue */ } }

    const { rows } = await query('SELECT * FROM cortesias ORDER BY created_at DESC, id DESC LIMIT 500');
    const cortesias = rows.map(view);

    // Todas as liberações gratuitas (cortesia pessoal, link, admin manual, modo grátis).
    const lib = await query(
      `SELECT l.id, l.nome, l.email, l.jornada, l.mp_payment_id, l.updated_at
         FROM leads l
        WHERE l.payment_status = 'paid' AND (l.mp_payment_id LIKE 'cortesia%' OR l.mp_payment_id = 'free')
        ORDER BY l.updated_at DESC LIMIT 300`);
    const usos = {};
    try {
      const u = await query('SELECT lead_id, cortesia_id, origem, actor, created_at FROM cortesia_usos ORDER BY id DESC LIMIT 2000');
      for (const x of u.rows) if (x.lead_id && !usos[x.lead_id]) usos[x.lead_id] = x;
    } catch (e) { /* sem histórico ainda */ }
    const porCode = {};
    for (const c of cortesias) porCode[c.code] = c;

    const liberacoes = lib.rows.map((l) => {
      const mp = String(l.mp_payment_id || '');
      const code = mp.startsWith('cortesia:') ? mp.slice(9) : '';
      const u = usos[l.id];
      let origem = 'Link de cortesia';
      if (mp === 'free') origem = 'Modo grátis (geral)';
      else if (mp === 'cortesia') origem = 'Liberação manual (Testes)';
      else if (porCode[code] && porCode[code].tipo === 'pessoa') origem = 'Cortesia pessoal';
      return {
        lead_id: l.id, nome: l.nome, email: l.email, jornada: l.jornada,
        jornada_label: C.JORNADA_LABEL[l.jornada] || l.jornada,
        origem, code, por: (u && u.actor) || (porCode[code] && porCode[code].created_by) || null,
        quando: (u && u.created_at) || l.updated_at,
      };
    });

    const limite30 = Date.now() - 30 * 86400000;
    return json(res, {
      ok: true,
      pode_editar: podeEditar,
      importados,
      free_mode: (await getSetting('free_mode', '0')) === '1',
      jornadas: C.JORNADAS.map((j) => ({ id: j, label: C.JORNADA_LABEL[j] })),
      kpis: {
        ativas: cortesias.filter((c) => c.estado === 'ativa').length,
        pessoas: cortesias.filter((c) => c.tipo === 'pessoa').length,
        links: cortesias.filter((c) => c.tipo === 'link').length,
        aguardando: cortesias.filter((c) => c.tipo === 'pessoa' && c.estado === 'ativa' && c.uses === 0).length,
        liberacoes: liberacoes.length,
        liberacoes_30d: liberacoes.filter((l) => new Date(l.quando).getTime() >= limite30).length,
      },
      cortesias, liberacoes,
    });
  }

  // ── QUEM USOU uma cortesia ───────────────────────────────
  if (op === 'usos') {
    const id = Number(req.query && req.query.id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query(
      `SELECT u.email, u.jornada, u.created_at, l.nome, l.id AS lead_id
         FROM cortesia_usos u LEFT JOIN leads l ON l.id = u.lead_id
        WHERE u.cortesia_id = $1 ORDER BY u.created_at DESC LIMIT 500`, [id]);
    return json(res, { ok: true, data: rows.map((r) => ({ ...r, jornada_label: C.JORNADA_LABEL[r.jornada] || r.jornada })) });
  }

  if (req.method !== 'POST') return err(res, 'Use POST', 405);
  if (!podeEditar) return err(res, 'Seu perfil não tem permissão para liberar cortesias.', 403);
  const body = getJsonBody(req) || {};

  // ── CRIAR ────────────────────────────────────────────────
  if (op === 'create') {
    const tipo = body.tipo === 'link' ? 'link' : 'pessoa';
    const nome = String(body.nome || '').trim().slice(0, 160) || null;
    const email = C.normEmail(body.email);
    const empresa = String(body.empresa || '').trim().slice(0, 160) || null;
    const motivo = String(body.motivo || '').trim().slice(0, 200) || null;
    const jornadas = C.parseJornadas(body.jornadas).join(',');
    const expires = /^\d{4}-\d{2}-\d{2}$/.test(String(body.expires || '')) ? String(body.expires) : '';
    const max_uses = Math.max(0, Math.min(1000000, parseInt(body.max_uses, 10) || 0));

    if (expires && expires < C.today()) return err(res, 'A validade informada já passou.');
    if (tipo === 'pessoa') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'Informe um e-mail válido para a cortesia pessoal.');
    }

    let code = C.normCode(body.code);
    if (tipo === 'link' && body.code && !code) return err(res, 'Código inválido — use letras, números, hífen ou sublinhado.');
    if (code) {
      const ja = await query('SELECT id FROM cortesias WHERE code = $1', [code]);
      if (ja.rows[0]) return err(res, `Já existe uma cortesia com o código ${code}.`);
    } else {
      for (let i = 0; i < 5 && !code; i++) {
        const tent = C.genCode(tipo === 'link' ? 'LINK' : 'CORT');
        const ja = await query('SELECT id FROM cortesias WHERE code = $1', [tent]);
        if (!ja.rows[0]) code = tent;
      }
      if (!code) return err(res, 'Não foi possível gerar o código. Tente de novo.', 500);
    }

    const ins = await query(
      `INSERT INTO cortesias (tipo, code, nome, email, empresa, jornadas, motivo, max_uses, expires, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tipo, code, nome, tipo === 'pessoa' ? email : null, empresa, jornadas, motivo, max_uses, expires, actor.nome || 'admin']);
    const c = ins.rows[0];

    let invite_ok = null;
    if (tipo === 'pessoa' && body.send_invite) invite_ok = await enviarConvite(c);

    // Testes que essa pessoa JÁ concluiu e ainda não liberou — a cortesia vale
    // para eles também (ela só precisa abrir o teste e clicar em liberar).
    let pendentes = 0;
    if (tipo === 'pessoa') {
      try {
        const p = await query(
          "SELECT jornada FROM leads WHERE email = $1 AND report_json IS NOT NULL AND payment_status <> 'paid'", [email]);
        const js = C.parseJornadas(jornadas);
        pendentes = p.rows.filter((r) => !js.length || js.includes(r.jornada)).length;
      } catch (e) {}
    }

    await logAdmin(req, 'cortesia_create', `${tipo} ${code}${email ? ' ' + email : ''} [${jornadas || 'todos'}]`);
    const fresh = await query('SELECT * FROM cortesias WHERE id = $1', [c.id]);
    return json(res, { ok: true, cortesia: view(fresh.rows[0]), invite_ok, testes_pendentes: pendentes });
  }

  // ── REVOGAR / REATIVAR ───────────────────────────────────
  if (op === 'toggle') {
    const id = Number(body.id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query('SELECT * FROM cortesias WHERE id = $1', [id]);
    if (!rows[0]) return err(res, 'Cortesia não encontrada', 404);
    const novo = rows[0].status === 'ativa' ? 'revogada' : 'ativa';
    const up = await query('UPDATE cortesias SET status = $2 WHERE id = $1 RETURNING *', [id, novo]);
    await logAdmin(req, 'cortesia_' + (novo === 'ativa' ? 'reativar' : 'revogar'), `${rows[0].code}${rows[0].email ? ' ' + rows[0].email : ''}`);
    return json(res, { ok: true, cortesia: view(up.rows[0]) });
  }

  // ── REENVIAR CONVITE ─────────────────────────────────────
  if (op === 'resend') {
    const id = Number(body.id);
    if (!id) return err(res, 'id obrigatório');
    const { rows } = await query('SELECT * FROM cortesias WHERE id = $1', [id]);
    const c = rows[0];
    if (!c) return err(res, 'Cortesia não encontrada', 404);
    if (!c.email) return err(res, 'Esta cortesia é um link — não tem e-mail para convidar.');
    if (C.estadoDe(c) !== 'ativa') return err(res, 'Esta cortesia não está ativa. Reative antes de reenviar.');
    const ok = await enviarConvite(c);
    await logAdmin(req, 'cortesia_convite', `${c.code} ${c.email} ${ok ? 'ok' : 'FALHOU'}`);
    if (!ok) return err(res, 'Não foi possível enviar o e-mail (verifique o SMTP). Copie o link e envie você mesmo.', 502);
    return json(res, { ok: true });
  }

  return err(res, 'op inválida (use list|create|toggle|resend|usos)');
};
