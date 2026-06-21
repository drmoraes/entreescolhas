// POST /api/lead_save_report — chamado pelo teste.html ao concluir o teste.
// Salva o relatório calculado, conta a tentativa e, se o lead já estiver
// pago (retomada), reenvia o relatório completo por e-mail na hora.
const { setCors, json, err, getJsonBody } = require('./_lib/http');
const { query } = require('./_lib/db');
const mailer = require('./_lib/mailer');
const { buildReportEmailHtml } = require('./_lib/report-email');

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const data = getJsonBody(req);
  if (!data) return err(res, 'Invalid JSON');

  const access = String(data.access ?? '').trim();
  const report = data.report ?? null;
  if (!access) return err(res, 'access obrigatório');
  if (!report) return err(res, 'report obrigatório');

  const { rows } = await query(
    `SELECT id, nome, email, jornada, confirmed_at, payment_status, attempts_used
     FROM leads WHERE access_token = $1`,
    [access]
  );
  const lead = rows[0];
  if (!lead) return err(res, 'Acesso inválido', 404);
  if (!lead.confirmed_at) return err(res, 'E-mail ainda não confirmado', 403);

  const maxAttempts = Number(process.env.MAX_TEST_ATTEMPTS || 3);
  if (Number(lead.attempts_used) >= maxAttempts) {
    return err(res, 'Limite de tentativas atingido para esta jornada', 403);
  }

  const novasTentativas = Number(lead.attempts_used) + 1;
  const jaPago = lead.payment_status === 'paid';

  // Registro histórico da tentativa (não bloqueia o fluxo se falhar)
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    await query(
      `INSERT INTO test_attempts (lead_id, jornada, attempt_no, report_json, arquetipo, paid, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [lead.id, lead.jornada, novasTentativas, JSON.stringify(report),
       (report && report.arch && report.arch.name) ? String(report.arch.name).slice(0, 120) : null,
       jaPago, ip]
    );
  } catch (e) { console.error('test_attempts insert falhou:', e.message); }

  if (jaPago) {
    await query(
      `UPDATE leads SET report_json = $1, attempts_used = $2, report_sent_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(report), novasTentativas, lead.id]
    );

    const html = buildReportEmailHtml(lead.nome, report);
    await mailer.send(lead.email, 'Seu relatório completo — Entre Escolhas', html);
    // Não bloqueia a resposta por falha de e-mail aqui; o relatório já está salvo
  } else {
    await query(
      `UPDATE leads SET report_json = $1, attempts_used = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(report), novasTentativas, lead.id]
    );
  }

  json(res, {
    ok: true,
    attempts_used: novasTentativas,
    max_attempts: maxAttempts,
    paid: jaPago,
  });
};
