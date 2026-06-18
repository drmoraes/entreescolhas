<?php
// ═══════════════════════════════════════════════════════════
// POST /api/lead_save_report.php — chamado pelo teste.html ao concluir
// o teste. Salva o relatório calculado, conta a tentativa e, se o lead
// já estiver pago (retomada), reenvia o relatório completo por e-mail
// na hora (pois não haverá novo webhook do Mercado Pago nesse caso).
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Mailer.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Method not allowed', 405);

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) err('Invalid JSON');

$access = trim($data['access'] ?? '');
$report = $data['report'] ?? null;
if ($access === '') err('access obrigatório');
if (!$report) err('report obrigatório');

$db = getDB();
$stmt = $db->prepare('SELECT id, nome, email, jornada, confirmed_at, payment_status, attempts_used FROM leads WHERE access_token = ?');
$stmt->execute([$access]);
$lead = $stmt->fetch();

if (!$lead) err('Acesso inválido', 404);
if (!$lead['confirmed_at']) err('E-mail ainda não confirmado', 403);
if ((int) $lead['attempts_used'] >= MAX_TEST_ATTEMPTS) err('Limite de tentativas atingido para esta jornada', 403);

$novasTentativas = (int) $lead['attempts_used'] + 1;
$reportJson = json_encode($report, JSON_UNESCAPED_UNICODE);

$jaPago = $lead['payment_status'] === 'paid';

if ($jaPago) {
    $upd = $db->prepare('
        UPDATE leads SET report_json = ?, attempts_used = ?, report_sent_at = NOW(), updated_at = NOW()
        WHERE id = ?
    ');
    $upd->execute([$reportJson, $novasTentativas, $lead['id']]);

    $mailer = new Mailer();
    $html = buildReportEmailHtml($lead['nome'], $report);
    $mailer->send($lead['email'], 'Seu relatório completo — Entre Escolhas', $html);
    // Não bloqueia a resposta por falha de e-mail aqui; o relatório já está salvo
} else {
    $upd = $db->prepare('
        UPDATE leads SET report_json = ?, attempts_used = ?, updated_at = NOW()
        WHERE id = ?
    ');
    $upd->execute([$reportJson, $novasTentativas, $lead['id']]);
}

json([
    'ok'            => true,
    'attempts_used' => $novasTentativas,
    'max_attempts'  => MAX_TEST_ATTEMPTS,
    'paid'          => $jaPago,
]);

function buildReportEmailHtml(string $nome, array $report): string
{
    $arch = $report['arch'] ?? [];
    $name = htmlspecialchars($arch['name'] ?? '');
    $mode = htmlspecialchars($arch['mode'] ?? '');
    $desc = htmlspecialchars($arch['desc'] ?? '');

    $dimsHtml = '';
    foreach (($report['scores'] ?? []) as $dim => $val) {
        $label = htmlspecialchars($report['dimNames'][$dim] ?? $dim);
        $dimsHtml .= "<p>{$label}: <strong>{$val}/100</strong></p>";
    }

    $insightsHtml = '';
    foreach (($arch['insights'] ?? []) as $insight) {
        $title = htmlspecialchars($insight['title'] ?? '');
        $text  = htmlspecialchars($insight['text'] ?? '');
        $insightsHtml .= "<p><strong>{$title}</strong><br>{$text}</p>";
    }

    return "
      <p>Olá, " . htmlspecialchars($nome) . "!</p>
      <p>Seu relatório completo do Entre Escolhas está pronto:</p>
      <h2>{$name}</h2>
      <p>{$mode}</p>
      <p>{$desc}</p>
      <h3>Suas dimensões</h3>
      {$dimsHtml}
      <h3>Insights</h3>
      {$insightsHtml}
      <p>Você pode acessar este relatório novamente a qualquer momento pelo link enviado no e-mail de confirmação.</p>
    ";
}
