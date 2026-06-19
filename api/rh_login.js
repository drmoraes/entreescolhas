// POST /api/rh_login        — { email, password } → { session, company, user }
// POST /api/rh_login?action=register — cria empresa + usuário owner (com trial bônus)
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const { hashPassword, verifyPassword, newSession, postLedger, logAccess } = require('./_lib/b2b-auth');
const { checkRateLimit, getClientIp } = require('./_lib/rate-limit');

const TRIAL_BONUS = 5;

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const rl = await checkRateLimit(req, 'rh_login', 20);
  if (!rl.ok) return err(res, 'Muitas tentativas. Tente novamente em uma hora.', 429);

  const body = getJsonBody(req);
  if (!body) return err(res, 'Invalid JSON');
  const email = String(body.email || '').toLowerCase().trim();
  const password = String(body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(res, 'E-mail inválido');
  if (password.length < 6) return err(res, 'Senha deve ter ao menos 6 caracteres');

  const action = (req.query && req.query.action) || '';

  // ── Registro de nova empresa ───────────────────────────────
  if (action === 'register') {
    const companyName = String(body.company || '').trim();
    const userName = String(body.nome || '').trim();
    if (companyName.length < 2) return err(res, 'Nome da empresa obrigatório');
    if (userName.length < 2) return err(res, 'Seu nome é obrigatório');

    const dup = await query('SELECT id FROM company_users WHERE email = $1', [email]);
    if (dup.rows[0]) return err(res, 'E-mail já cadastrado', 409);

    const comp = await query(
      `INSERT INTO companies (nome, email, plan, status) VALUES ($1,$2,'trial','ativa') RETURNING id`,
      [companyName, email]
    );
    const companyId = comp.rows[0].id;

    const sess = newSession();
    const u = await query(
      `INSERT INTO company_users (company_id, nome, email, password_hash, role, session_token, session_expires, last_login)
       VALUES ($1,$2,$3,$4,'owner',$5,$6,NOW()) RETURNING id, nome, email, role`,
      [companyId, userName, email, hashPassword(password), sess.token, sess.expires]
    );

    // crédito bônus de trial (expira em 14 dias)
    const expires = new Date(Date.now() + 14 * 86400000);
    await query(
      `INSERT INTO credit_ledger (company_id, delta, reason, balance_after, expires_at, meta)
       VALUES ($1,$2,'bonus',$2,$3,$4)`,
      [companyId, TRIAL_BONUS, expires, JSON.stringify({ desc: 'Crédito bônus de boas-vindas' })]
    );

    await logAccess({ company_id: companyId, user_id: u.rows[0].id }, null, 'login', 'register', getClientIp(req));

    return json(res, {
      session: sess.token,
      company: { id: companyId, nome: companyName, plan: 'trial' },
      user: u.rows[0],
      balance: TRIAL_BONUS,
      welcome: true,
    }, 201);
  }

  // ── Login ──────────────────────────────────────────────────
  const { rows } = await query(
    `SELECT u.*, c.nome AS company_nome, c.plan, c.status AS company_status
       FROM company_users u JOIN companies c ON c.id = u.company_id
      WHERE u.email = $1`,
    [email]
  );
  const u = rows[0];
  if (!u || !verifyPassword(password, u.password_hash)) {
    return err(res, 'E-mail ou senha incorretos', 401);
  }
  if (u.company_status !== 'ativa') return err(res, 'Conta inativa ou suspensa', 403);

  const sess = newSession();
  await query(
    'UPDATE company_users SET session_token = $1, session_expires = $2, last_login = NOW() WHERE id = $3',
    [sess.token, sess.expires, u.id]
  );
  await logAccess({ company_id: u.company_id, user_id: u.id }, null, 'login', 'login', getClientIp(req));

  const bal = await query('SELECT COALESCE(SUM(delta),0)::int AS s FROM credit_ledger WHERE company_id=$1', [u.company_id]);

  return json(res, {
    session: sess.token,
    company: { id: u.company_id, nome: u.company_nome, plan: u.plan },
    user: { id: u.id, nome: u.nome, email: u.email, role: u.role },
    balance: bal.rows[0].s,
  });
};
