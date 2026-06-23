// /api/b2b?fn=referral&op=... — Programa de Afiliados e Recompensas (público).
//   op=prices        → preços + percentuais vigentes (sem auth)
//   op=resolve       → valida um código e devolve o desconto do indicado
//   op=code          → cria/recupera o código do afiliado a partir do access token
//   op=accept_terms  → registra o aceite do regulamento (prova jurídica)
//   op=save_pix      → salva CPF + chave Pix do afiliado (para saque)
//   op=balance       → saldo/estatísticas do afiliado
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const {
  getPriceSingle, getPriceCombo, getDiscountPct, getCommissionPct,
  getReferralWindowDays, getReferralWindowCard, getMinPayout, isReferralEnabled,
} = require('./_lib/settings');

const TERMS_VERSION = '2.1';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I,O,0,1

function randSuffix(n = 4) {
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function baseFromName(name) {
  const clean = String(name || 'EE').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z]/g, '');
  return (clean.slice(0, 6) || 'EE');
}

async function getOrCreateCode(email, name) {
  const ex = await query('SELECT code FROM referral_codes WHERE owner_email = $1', [email]);
  if (ex.rows[0]) return ex.rows[0].code;
  const base = baseFromName(name);
  for (let i = 0; i < 8; i++) {
    const code = (base + randSuffix(4)).slice(0, 20);
    try {
      await query(
        'INSERT INTO referral_codes (code, owner_email, owner_name) VALUES ($1,$2,$3)',
        [code, email, name || null]);
      return code;
    } catch (e) {
      if (/unique|duplicate/i.test(e.message)) {
        // pode ser corrida no owner_email — relê
        const again = await query('SELECT code FROM referral_codes WHERE owner_email = $1', [email]);
        if (again.rows[0]) return again.rows[0].code;
        continue; // colisão de code → tenta outro
      }
      throw e;
    }
  }
  throw new Error('Não foi possível gerar um código de indicação.');
}

async function leadByAccess(access) {
  const { rows } = await query(
    'SELECT id, nome, email, confirmed_at FROM leads WHERE access_token = $1', [access]);
  return rows[0] || null;
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  const op = String((req.query && req.query.op) || 'prices');

  // ── preços + percentuais (público) ──────────────────────
  if (op === 'prices') {
    return json(res, {
      ok: true,
      enabled: await isReferralEnabled(),
      price_single: await getPriceSingle(),
      price_combo: await getPriceCombo(),
      discount_pct: await getDiscountPct(),
      commission_pct: await getCommissionPct(),
      window_pix: await getReferralWindowDays(),
      window_card: await getReferralWindowCard(),
      min_payout: await getMinPayout(),
      terms_version: TERMS_VERSION,
    });
  }

  // ── valida um código de indicação ───────────────────────
  if (op === 'resolve') {
    const code = String((req.query && req.query.code) || '').trim().toUpperCase();
    if (!code) return json(res, { ok: true, valid: false });
    if (!(await isReferralEnabled())) return json(res, { ok: true, valid: false });
    const { rows } = await query('SELECT code, owner_name FROM referral_codes WHERE code = $1', [code]);
    if (!rows[0]) return json(res, { ok: true, valid: false });
    return json(res, {
      ok: true, valid: true, code: rows[0].code,
      owner_name: (rows[0].owner_name || '').split(' ')[0] || null,
      discount_pct: await getDiscountPct(),
    });
  }

  // ── cria/recupera o código do afiliado ──────────────────
  if (op === 'code') {
    const access = String((req.query && req.query.access) || '').trim();
    if (!access) return err(res, 'access obrigatório');
    const lead = await leadByAccess(access);
    if (!lead) return err(res, 'Acesso inválido', 404);
    if (!lead.confirmed_at) return err(res, 'Confirme seu e-mail antes de indicar', 403);
    const code = await getOrCreateCode(lead.email, lead.nome);
    const base = process.env.APP_BASE_URL || '';
    return json(res, {
      ok: true, code,
      link: `${base}/?ref=${encodeURIComponent(code)}`,
      commission_pct: await getCommissionPct(),
      discount_pct: await getDiscountPct(),
    });
  }

  // ── aceite do regulamento ───────────────────────────────
  if (op === 'accept_terms') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const b = getJsonBody(req) || {};
    const access = String(b.access || '').trim();
    const lead = access ? await leadByAccess(access) : null;
    if (!lead) return err(res, 'Acesso inválido', 404);
    const code = await getOrCreateCode(lead.email, lead.nome);
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    const ua = String(req.headers['user-agent'] || '').slice(0, 255);
    await query(
      'INSERT INTO affiliate_terms (email, code, terms_version, ip, user_agent) VALUES ($1,$2,$3,$4,$5)',
      [lead.email, code, TERMS_VERSION, ip, ua]);
    return json(res, { ok: true, code, terms_version: TERMS_VERSION });
  }

  // ── salva CPF + chave Pix do afiliado ───────────────────
  if (op === 'save_pix') {
    if (req.method !== 'POST') return err(res, 'Use POST', 405);
    const b = getJsonBody(req) || {};
    const access = String(b.access || '').trim();
    const lead = access ? await leadByAccess(access) : null;
    if (!lead) return err(res, 'Acesso inválido', 404);
    const cpf = String(b.cpf || '').replace(/\D/g, '');
    const pixKey = String(b.pix_key || '').trim().slice(0, 140);
    const pixType = ['cpf', 'email', 'telefone', 'aleatoria'].includes(b.pix_key_type) ? b.pix_key_type : null;
    if (cpf.length !== 11) return err(res, 'CPF inválido');
    if (!pixKey) return err(res, 'Chave Pix obrigatória');
    await getOrCreateCode(lead.email, lead.nome);
    await query(
      `UPDATE referral_codes SET cpf=$1, pix_key=$2, pix_key_type=$3, updated_at=NOW() WHERE owner_email=$4`,
      [cpf, pixKey, pixType, lead.email]);
    return json(res, { ok: true });
  }

  // ── saldo / estatísticas do afiliado ────────────────────
  if (op === 'balance') {
    const access = String((req.query && req.query.access) || '').trim();
    const lead = access ? await leadByAccess(access) : null;
    if (!lead) return err(res, 'Acesso inválido', 404);
    const cr = await query('SELECT code FROM referral_codes WHERE owner_email = $1', [lead.email]);
    const code = cr.rows[0] ? cr.rows[0].code : null;
    let stats = { pending: 0, released: 0, paid: 0, sales: 0 };
    if (code) {
      const { rows } = await query(
        `SELECT
           COALESCE(SUM(CASE WHEN status='pending'  THEN commission_amount END),0) AS pending,
           COALESCE(SUM(CASE WHEN status='released' THEN commission_amount END),0) AS released,
           COALESCE(SUM(CASE WHEN status='paid'     THEN commission_amount END),0) AS paid,
           COUNT(*) FILTER (WHERE status IN ('pending','released','paid')) AS sales
         FROM affiliate_commissions WHERE referrer_code = $1`, [code]);
      const r = rows[0] || {};
      stats = {
        pending: Number(r.pending) || 0,
        released: Number(r.released) || 0,
        paid: Number(r.paid) || 0,
        sales: Number(r.sales) || 0,
      };
    }
    return json(res, {
      ok: true, code,
      link: code ? `${process.env.APP_BASE_URL || ''}/?ref=${encodeURIComponent(code)}` : null,
      min_payout: await getMinPayout(),
      ...stats,
    });
  }

  return err(res, 'op inválida');
};
