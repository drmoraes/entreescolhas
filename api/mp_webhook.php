<?php
// ═══════════════════════════════════════════════════════════
// GET|POST /api/mp_webhook.php — recebido pelo Mercado Pago a cada
// evento de pagamento. Confirma o pagamento direto na API do MP
// (nunca confia só no payload recebido) e libera o relatório.
// Sempre responde 200 rapidamente para evitar reenvios em loop.
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Mailer.php';

// Aceita tanto o formato novo (type/data.id) quanto o legado (topic/id)
$type = $_GET['type'] ?? $_GET['topic'] ?? '';
$paymentId = $_GET['data_id'] ?? $_GET['id'] ?? null;

// Algumas notificações do MP mandam "data[id]" via querystring com ponto
if (!$paymentId && isset($_GET['data']['id'])) {
    $paymentId = $_GET['data']['id'];
}

if ($type !== 'payment' || !$paymentId) {
    http_response_code(200);
    echo 'ignored';
    exit;
}

$ch = curl_init('https://api.mercadopago.com/v1/payments/' . urlencode((string) $paymentId));
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . MP_ACCESS_TOKEN],
    CURLOPT_TIMEOUT        => 15,
]);
$response = curl_exec($ch);
curl_close($ch);

if ($response === false) {
    error_log('mp_webhook: falha ao consultar pagamento ' . $paymentId);
    http_response_code(200);
    echo 'error-logged';
    exit;
}

$payment = json_decode($response, true);
$status  = $payment['status'] ?? null;
$accessToken = $payment['external_reference'] ?? null;

if ($status === 'approved' && $accessToken) {
    $db = getDB();
    $stmt = $db->prepare('SELECT id, nome, email, payment_status, report_json, report_sent_at FROM leads WHERE access_token = ?');
    $stmt->execute([$accessToken]);
    $lead = $stmt->fetch();

    if ($lead && $lead['payment_status'] !== 'paid') {
        $upd = $db->prepare('UPDATE leads SET payment_status = ?, mp_payment_id = ?, updated_at = NOW() WHERE id = ?');
        $upd->execute(['paid', (string) $paymentId, $lead['id']]);

        if ($lead['report_json'] && !$lead['report_sent_at']) {
            $report = json_decode($lead['report_json'], true);
            $mailer = new Mailer();
            $html = buildReportEmailHtml($lead['nome'], $report);
            $sent = $mailer->send($lead['email'], 'Seu relatório completo — Entre Escolhas', $html);
            if ($sent) {
                $db->prepare('UPDATE leads SET report_sent_at = NOW() WHERE id = ?')->execute([$lead['id']]);
            } else {
                error_log('mp_webhook: falha ao enviar e-mail — ' . $mailer->getLastError());
            }
        }
    }
}

http_response_code(200);
echo 'ok';

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
      <p>Seu pagamento foi confirmado e seu relatório completo do Entre Escolhas está pronto:</p>
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
