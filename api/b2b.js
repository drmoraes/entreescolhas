// Roteador único do Banco de Talentos B2B.
// Consolida todos os endpoints B2B em UMA função serverless (limite do plano Hobby: 12).
// Despacha pelo parâmetro ?fn=  — os handlers continuam usando ?action= internamente.
//   /api/b2b?fn=login            (+ ?action=register para cadastro)
//   /api/b2b?fn=search | candidate | unlock | wallet | invite | dispute
//   /api/b2b?fn=admin_stats
//   /api/b2b?fn=cand_portal      (+ ?action=reconfirm|visibility|consent|respond)
//   /api/b2b?fn=mp_webhook_credits   (webhook do Mercado Pago — créditos)
//   /api/b2b?fn=cron_sla             (cron diário de SLA)
const { setCors, err } = require('./_lib/http');

const handlers = {
  login:              require('./_rh_login'),
  search:             require('./_rh_search'),
  candidate:          require('./_rh_candidate'),
  unlock:             require('./_rh_unlock'),
  wallet:             require('./_rh_wallet'),
  invite:             require('./_rh_invite'),
  dispute:            require('./_rh_dispute'),
  admin_stats:        require('./_admin_b2b_stats'),
  admin_grant_credits: require('./_admin_grant'),
  admin_migrate:      require('./_admin_migrate'),
  admin_tests:        require('./_admin_tests'),
  admin_company:      require('./_admin_company'),
  admin_candidates:   require('./_admin_candidates'),
  admin_coupons:      require('./_admin_coupons'),
  admin_users:        require('./_admin_users'),
  cand_portal:        require('./_cand_portal'),
  mp_webhook_credits: require('./_mp_webhook_credits'),
  cron_sla:           require('./_cron_sla'),
};

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  let fn = (req.query && req.query.fn) || '';
  // chamada do Vercel Cron chega em /api/b2b (sem fn) com este header → roda o SLA
  if (!fn && req.headers && req.headers['x-vercel-cron']) fn = 'cron_sla';
  const handler = handlers[fn];
  if (!handler) return err(res, 'Endpoint B2B desconhecido: ' + fn, 404);
  try {
    return await handler(req, res);
  } catch (e) {
    console.error('[b2b] erro em fn=' + fn + ':', e);
    return err(res, e.message || 'Erro interno', 500);
  }
};
