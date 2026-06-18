<?php
// ═══════════════════════════════════════════════════════════
// POST /api/mp_create_preference.php — cria a preference do Checkout Pro
// e devolve o init_point para o front-end redirecionar o usuário.
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Method not allowed', 405);

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) err('Invalid JSON');

$access = trim($data['access'] ?? '');
if ($access === '') err('access obrigatório');

$db = getDB();
$stmt = $db->prepare('SELECT id, email, jornada, confirmed_at, payment_status, report_json FROM leads WHERE access_token = ?');
$stmt->execute([$access]);
$lead = $stmt->fetch();

if (!$lead) err('Acesso inválido', 404);
if (!$lead['confirmed_at']) err('E-mail ainda não confirmado', 403);
if (!$lead['report_json']) err('Conclua o teste antes de desbloquear o relatório', 403);

if ($lead['payment_status'] === 'paid') {
    json(['ok' => true, 'already_paid' => true]);
}

$backBase = APP_BASE_URL . '/obrigado.html?access=' . urlencode($access) . '&jornada=' . urlencode($lead['jornada']);
$failureUrl = APP_BASE_URL . '/teste.html?jornada=' . urlencode($lead['jornada']) . '&access=' . urlencode($access) . '&pagamento=falhou';

$payload = [
    'items' => [[
        'title'       => 'Relatório completo — Entre Escolhas',
        'quantity'    => 1,
        'currency_id' => 'BRL',
        'unit_price'  => (float) MP_REPORT_PRICE,
    ]],
    'payer' => [
        'email' => $lead['email'],
    ],
    'external_reference' => $access,
    'back_urls' => [
        'success' => $backBase,
        'pending' => $backBase,
        'failure' => $failureUrl,
    ],
    'auto_return'      => 'approved',
    'notification_url' => APP_BASE_URL . '/api/mp_webhook.php',
];

$ch = curl_init('https://api.mercadopago.com/checkout/preferences');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . MP_ACCESS_TOKEN,
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT    => 15,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($response === false) {
    error_log('mp_create_preference: curl error — ' . $curlErr);
    err('Não foi possível iniciar o pagamento agora. Tente novamente.', 502);
}

$result = json_decode($response, true);

if ($httpCode >= 300 || !isset($result['init_point'])) {
    error_log('mp_create_preference: resposta inesperada do Mercado Pago — ' . $response);
    err('Não foi possível iniciar o pagamento agora. Tente novamente.', 502);
}

$upd = $db->prepare('UPDATE leads SET mp_preference_id = ?, updated_at = NOW() WHERE id = ?');
$upd->execute([$result['id'] ?? null, $lead['id']]);

json(['ok' => true, 'init_point' => $result['init_point']]);
