// /api/b2b?fn=admin_clientes&op=list|get — visão de CLIENTES (pessoas / B2C).
// Responde, num lugar só: quem são os clientes, quais testes cada um fez, quem
// pagou, quem ganhou cortesia e quem concluiu o teste mas ainda não liberou.
// Uma linha por PESSOA (e-mail), juntando todos os testes dela.
// (Empresas/B2B continuam em admin_stats / admin_company.)
const { setCors, json, err, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');
const C = require('./_lib/cortesia');

const MAX = () => Number(process.env.MAX_TEST_ATTEMPTS || 3);

function statusTeste(l, max) {
  if (!l.confirmed_at) return 'pendente';
  if (l.has_report) return 'concluido';
  if (Number(l.attempts_used) >= max) return 'travado';
  if (Number(l.attempts_used) > 0) return 'incompleto';
  return 'confirmado';
}

// Situação comercial da pessoa (a mais "forte" vence).
function situacao(p) {
  if (p.pagos > 0 || p.total_pago > 0) return 'pagante';
  if (p.cortesias > 0) return 'cortesia';
  if (p.gratis > 0) return 'gratis';
  if (p.concluidos > 0) return 'nao_liberou';   // fez o teste e parou no paywall
  if (p.cortesia_ativa) return 'convidado';      // tem cortesia e ainda não usou
  return 'cadastro';
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!(await requireApiKey(req, res))) return;
  const op = String((req.query && req.query.op) || 'list');
  const max = MAX();

  // ── LISTA (1 linha por pessoa) ───────────────────────────
  if (op === 'list') {
    const { rows } = await query(
      `SELECT id, nome, email, jornada, confirmed_at, payment_status, mp_payment_id, attempts_used,
              report_json IS NOT NULL AS has_report, created_at, updated_at
         FROM leads ORDER BY updated_at DESC LIMIT 5000`);

    const pessoas = new Map();
    for (const l of rows) {
      const email = C.normEmail(l.email);
      let p = pessoas.get(email);
      if (!p) {
        p = { email, nome: l.nome, testes: 0, concluidos: 0, pagos: 0, cortesias: 0, gratis: 0,
              total_pago: 0, jornadas: [], primeiro: l.created_at, ultimo: l.updated_at,
              cortesia_ativa: false, banco_talentos: false };
        pessoas.set(email, p);
      }
      p.testes++;
      if (l.has_report) p.concluidos++;
      const lib = C.origemLiberacao(l);
      if (lib === 'pago') p.pagos++;
      if (lib === 'cortesia') p.cortesias++;
      if (lib === 'gratis') p.gratis++;
      p.jornadas.push({ jornada: l.jornada, status: statusTeste(l, max), liberacao: lib });
      if (new Date(l.created_at) < new Date(p.primeiro)) p.primeiro = l.created_at;
      if (new Date(l.updated_at) > new Date(p.ultimo)) p.ultimo = l.updated_at;
    }

    // Valor pago por pessoa (tabela pode não existir antes da migração de afiliados).
    let receita = 0;
    try {
      const pg = await query("SELECT email, SUM(amount) AS total FROM purchases WHERE status = 'paid' GROUP BY email");
      for (const r of pg.rows) {
        const v = Number(r.total) || 0;
        receita += v;
        const p = pessoas.get(C.normEmail(r.email));
        if (p) p.total_pago = v;
      }
    } catch (e) { /* segue sem valores */ }

    // Cortesias pessoais ainda ativas (inclui convidados que nem se cadastraram).
    try {
      const cs = await query("SELECT * FROM cortesias WHERE tipo = 'pessoa' AND status = 'ativa'");
      for (const c of cs.rows) {
        if (C.estadoDe(c) !== 'ativa') continue;
        const email = C.normEmail(c.email);
        let p = pessoas.get(email);
        if (!p) {
          p = { email, nome: c.nome || '(convidado)', testes: 0, concluidos: 0, pagos: 0, cortesias: 0, gratis: 0,
                total_pago: 0, jornadas: [], primeiro: c.created_at, ultimo: c.created_at,
                cortesia_ativa: true, banco_talentos: false, empresa: c.empresa || null };
          pessoas.set(email, p);
        }
        p.cortesia_ativa = true;
        if (c.empresa && !p.empresa) p.empresa = c.empresa;
      }
    } catch (e) { /* tabela de cortesias ainda não criada */ }

    // Quem também está no Banco de Talentos.
    try {
      const cand = await query("SELECT email FROM candidates WHERE status <> 'arquivado'");
      for (const r of cand.rows) { const p = pessoas.get(C.normEmail(r.email)); if (p) p.banco_talentos = true; }
    } catch (e) {}

    const data = [...pessoas.values()].map((p) => ({ ...p, situacao: situacao(p) }))
      .sort((a, b) => new Date(b.ultimo) - new Date(a.ultimo));

    const conta = (s) => data.filter((p) => p.situacao === s).length;
    const comTeste = data.filter((p) => p.concluidos > 0).length;
    const pagantes = conta('pagante');
    return json(res, {
      ok: true,
      kpis: {
        pessoas: data.length,
        testes: rows.length,
        concluiram: comTeste,
        pagantes,
        cortesia: conta('cortesia') + conta('gratis'),
        nao_liberou: conta('nao_liberou'),
        convidados: conta('convidado'),
        receita: Math.round(receita * 100) / 100,
        conversao_pct: comTeste ? Math.round((pagantes / comTeste) * 100) : 0,
      },
      jornadas: C.JORNADA_LABEL,
      truncado: rows.length >= 5000,
      data,
    });
  }

  // ── FICHA DA PESSOA ──────────────────────────────────────
  if (op === 'get') {
    const email = C.normEmail(req.query && req.query.email);
    if (!email) return err(res, 'email obrigatório');

    const { rows } = await query(
      `SELECT id, nome, email, jornada, confirmed_at, payment_status, mp_payment_id, attempts_used,
              report_json, report_sent_at, access_token, created_at, updated_at
         FROM leads WHERE LOWER(email) = $1 ORDER BY updated_at DESC`, [email]);

    const testes = rows.map((l) => {
      const rep = l.report_json || null;
      let arch = rep && rep.arch ? rep.arch.name : null;
      if (!arch && rep && rep.perfilCompleto && Array.isArray(rep.blocos)) {
        arch = rep.blocos.map((b) => b && b.arch && b.arch.name).filter(Boolean).join(' · ') || 'Perfil Completo';
      }
      const lr = { ...l, has_report: rep != null };
      return {
        lead_id: l.id, jornada: l.jornada, jornada_label: C.JORNADA_LABEL[l.jornada] || l.jornada,
        status: statusTeste(lr, max), liberacao: C.origemLiberacao(l),
        cortesia_code: String(l.mp_payment_id || '').startsWith('cortesia:') ? String(l.mp_payment_id).slice(9) : null,
        resultado: arch || null, attempts_used: Number(l.attempts_used), max_attempts: max,
        relatorio_enviado: l.report_sent_at, access_token: l.access_token,
        created_at: l.created_at, updated_at: l.updated_at,
      };
    });

    let compras = [];
    try {
      const pg = await query(
        `SELECT kind, jornada, amount, discount_amount, payment_method, status, paid_at, created_at
           FROM purchases WHERE LOWER(email) = $1 ORDER BY created_at DESC LIMIT 50`, [email]);
      compras = pg.rows;
    } catch (e) {}

    let cortesias = [];
    try {
      const cs = await query('SELECT * FROM cortesias WHERE email = $1 ORDER BY id DESC', [email]);
      cortesias = cs.rows.map((c) => ({
        id: c.id, code: c.code, nome: c.nome, estado: C.estadoDe(c), jornadas: C.parseJornadas(c.jornadas),
        motivo: c.motivo, empresa: c.empresa, expires: c.expires || '', uses: Number(c.uses) || 0,
        created_by: c.created_by, created_at: c.created_at,
      }));
    } catch (e) {}

    let candidato = null;
    try {
      const cd = await query('SELECT id, status, cargo, cidade, created_at FROM candidates WHERE LOWER(email) = $1 LIMIT 1', [email]);
      candidato = cd.rows[0] || null;
    } catch (e) {}

    if (!rows.length && !cortesias.length) return err(res, 'Pessoa não encontrada', 404);
    return json(res, {
      ok: true,
      pessoa: { email, nome: (rows[0] && rows[0].nome) || (cortesias[0] && cortesias[0].nome) || '' },
      testes, compras, cortesias, candidato,
    });
  }

  return err(res, 'op inválida (use list|get)');
};
