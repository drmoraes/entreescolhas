<?php
// ═══════════════════════════════════════════════════════════
// GET /api/lead_status.php?access=TOKEN — status do lead para o front-end
// decidir se libera o teste, mostra paywall ou já mostra o relatório pago.
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') err('Method not allowed', 405);

$access = trim($_GET['access'] ?? '');
if ($access === '') err('access obrigatório');

$db = getDB();
$stmt = $db->prepare('
    SELECT nome, jornada, confirmed_at, payment_status, attempts_used, report_json
    FROM leads WHERE access_token = ?
');
$stmt->execute([$access]);
$lead = $stmt->fetch();

if (!$lead) err('Acesso inválido', 404);

json([
    'ok'            => true,
    'nome'          => $lead['nome'],
    'jornada'       => $lead['jornada'],
    'confirmed'     => (bool) $lead['confirmed_at'],
    'paid'          => $lead['payment_status'] === 'paid',
    'attempts_used' => (int) $lead['attempts_used'],
    'max_attempts'  => MAX_TEST_ATTEMPTS,
    'has_report'    => $lead['report_json'] !== null,
]);
