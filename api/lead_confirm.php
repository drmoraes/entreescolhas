<?php
// ═══════════════════════════════════════════════════════════
// GET /api/lead_confirm.php?token=... — confirma o e-mail (ou apenas
// valida o link de acesso, se já confirmado antes) e redireciona para
// o teste com o access_token na URL.
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';

$token = trim($_GET['token'] ?? '');

if ($token === '') {
    header('Location: ' . APP_BASE_URL . '/confirmar-email.html?erro=invalido');
    exit;
}

$db = getDB();
$stmt = $db->prepare('SELECT id, jornada, access_token, confirmed_at FROM leads WHERE confirm_token = ?');
$stmt->execute([$token]);
$lead = $stmt->fetch();

if (!$lead) {
    header('Location: ' . APP_BASE_URL . '/confirmar-email.html?erro=invalido');
    exit;
}

if (!$lead['confirmed_at']) {
    $upd = $db->prepare('UPDATE leads SET confirmed_at = NOW() WHERE id = ?');
    $upd->execute([$lead['id']]);
}

// Rotaciona o confirm_token para que o link do e-mail não funcione de novo
$rotate = $db->prepare('UPDATE leads SET confirm_token = ? WHERE id = ?');
$rotate->execute([bin2hex(random_bytes(24)), $lead['id']]);

$dest = APP_BASE_URL . '/teste.html?jornada=' . urlencode($lead['jornada']) . '&access=' . urlencode($lead['access_token']);
header('Location: ' . $dest);
exit;
