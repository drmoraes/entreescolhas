<?php
// ═══════════════════════════════════════════════════════════
// GET /api/lead_report.php?access=TOKEN — devolve o relatório completo
// já salvo, somente se o lead estiver com pagamento confirmado.
// Usado pela página obrigado.html / teste.html para re-renderizar o
// relatório completo após o retorno do Mercado Pago.
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') err('Method not allowed', 405);

$access = trim($_GET['access'] ?? '');
if ($access === '') err('access obrigatório');

$db = getDB();
$stmt = $db->prepare('SELECT jornada, payment_status, report_json FROM leads WHERE access_token = ?');
$stmt->execute([$access]);
$lead = $stmt->fetch();

if (!$lead) err('Acesso inválido', 404);
if ($lead['payment_status'] !== 'paid') err('Relatório ainda não desbloqueado', 402);
if (!$lead['report_json']) err('Relatório ainda não gerado', 404);

json([
    'ok'      => true,
    'jornada' => $lead['jornada'],
    'report'  => json_decode($lead['report_json'], true),
]);
