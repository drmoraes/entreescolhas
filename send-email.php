<?php
// ═══════════════════════════════════════════════════════════════
// Entre Escolhas — Mailer PHP
// POST: { "to": "email@exemplo.com", "subject": "...", "body": "..." }
// ═══════════════════════════════════════════════════════════════

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método não permitido']);
    exit;
}

// Lê body JSON
$input = json_decode(file_get_contents('php://input'), true);

$to      = isset($input['to'])      ? trim($input['to'])      : '';
$subject = isset($input['subject']) ? trim($input['subject']) : 'Seu cupom Entre Escolhas';
$body    = isset($input['body'])    ? trim($input['body'])    : '';

// Validação básica
if (empty($to) || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email destinatário inválido']);
    exit;
}

if (empty($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Corpo do email vazio']);
    exit;
}

$from    = 'suporte@entreescolhas.com.br';
$fromName = 'Entre Escolhas';

// Cabeçalhos do email
$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: {$fromName} <{$from}>\r\n";
$headers .= "Reply-To: {$from}\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

// Template HTML do email
$htmlBody = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>' . htmlspecialchars($subject) . '</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#08080F;border-radius:12px;overflow:hidden;max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px;background:#6C63FF;">
              <p style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">
                Entre<span style="color:#ffffff;opacity:0.85;">Escolhas</span>
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;color:#e0e0e0;font-size:15px;line-height:1.7;">
              ' . nl2br(htmlspecialchars($body)) . '
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #222;color:#666;font-size:12px;">
              Esta mensagem foi enviada pela equipe Entre Escolhas.<br>
              Em caso de dúvidas, responda este email ou acesse
              <a href="https://www.entreescolhas.com.br" style="color:#6C63FF;">entreescolhas.com.br</a>.<br><br>
              <em>Esta plataforma não é um instrumento psicológico, não emite laudos e não substitui avaliação de saúde mental.</em>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>';

$sent = mail($to, $subject, $htmlBody, $headers);

if ($sent) {
    echo json_encode(['ok' => true, 'message' => "Email enviado para {$to}"]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Falha ao enviar email. Verifique as configurações do servidor.']);
}
