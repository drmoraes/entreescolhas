<?php
// ═══════════════════════════════════════════════════════════
// POST /api/lead_register.php — cadastro (nome+email) antes do teste
// Sempre responde de forma genérica (não revela se o e-mail já existe).
// Envia e-mail com link único: confirma e-mail (1ª vez) ou acesso direto
// (já confirmado antes) — em ambos os casos o link cai em lead_confirm.php
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Mailer.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Method not allowed', 405);

const ALLOWED_JORNADAS = ['arquetipo', 'fit-cultural', 'scanner', 'bussola'];

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) err('Invalid JSON');

$nome    = trim($data['nome'] ?? '');
$email   = strtolower(trim($data['email'] ?? ''));
$jornada = trim($data['jornada'] ?? '');

if (strlen($nome) < 2) err('Nome obrigatório');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) err('E-mail inválido');
if (!in_array($jornada, ALLOWED_JORNADAS, true)) err('Jornada inválida');

// ── Rate limit simples via IP (10 req/hora) ──────────────
$ip   = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$file = sys_get_temp_dir() . '/ec_rl_lead_' . md5($ip) . '.json';
$now  = time();
$rl   = file_exists($file) ? json_decode(file_get_contents($file), true) : ['ts' => $now, 'count' => 0];
if ($now - $rl['ts'] > 3600) { $rl = ['ts' => $now, 'count' => 0]; }
$rl['count']++;
file_put_contents($file, json_encode($rl));
if ($rl['count'] > 10) err('Muitas tentativas. Tente novamente em uma hora.', 429);

$db = getDB();

$confirmToken = bin2hex(random_bytes(24));

$stmt = $db->prepare('SELECT id, access_token, confirmed_at FROM leads WHERE email = ? AND jornada = ?');
$stmt->execute([$email, $jornada]);
$existing = $stmt->fetch();

if ($existing) {
    // Rotaciona o confirm_token a cada novo pedido (invalida links antigos)
    $upd = $db->prepare('UPDATE leads SET nome = ?, confirm_token = ?, ip = ?, updated_at = NOW() WHERE id = ?');
    $upd->execute([$nome, $confirmToken, $ip, $existing['id']]);
    $jaConfirmado = (bool) $existing['confirmed_at'];
} else {
    $accessToken = bin2hex(random_bytes(24));
    $ins = $db->prepare('
        INSERT INTO leads (nome, email, jornada, confirm_token, access_token, ip)
        VALUES (?, ?, ?, ?, ?, ?)
    ');
    $ins->execute([$nome, $email, $jornada, $confirmToken, $accessToken, $ip]);
    $jaConfirmado = false;
}

$link = APP_BASE_URL . '/api/lead_confirm.php?token=' . $confirmToken;

if ($jaConfirmado) {
    $subject = 'Seu link de acesso — Entre Escolhas';
    $html = "
      <p>Olá, " . htmlspecialchars($nome) . "!</p>
      <p>Aqui está o seu link de acesso ao teste/relatório do Entre Escolhas:</p>
      <p><a href=\"{$link}\">{$link}</a></p>
      <p>Se você não pediu este e-mail, pode ignorá-lo.</p>
    ";
} else {
    $subject = 'Confirme seu e-mail — Entre Escolhas';
    $html = "
      <p>Olá, " . htmlspecialchars($nome) . "!</p>
      <p>Falta só um passo para começar sua análise gratuita no Entre Escolhas. Confirme seu e-mail clicando no link abaixo:</p>
      <p><a href=\"{$link}\">{$link}</a></p>
      <p>Se você não pediu este e-mail, pode ignorá-lo.</p>
    ";
}

$mailer = new Mailer();
$sent = $mailer->send($email, $subject, $html);

if (!$sent) {
    error_log('lead_register: falha ao enviar e-mail — ' . $mailer->getLastError());
    // Não expõe detalhe de SMTP ao cliente; mas avisa que algo deu errado
    err('Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.', 502);
}

json(['ok' => true]);
