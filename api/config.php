<?php
// ═══════════════════════════════════════════════════════════
// Entre Escolhas — API Config
// Edite este arquivo com as credenciais do Locaweb
// ═══════════════════════════════════════════════════════════

define('DB_HOST', 'localhost');
define('DB_NAME', 'entreescolhas');   // nome do banco no Locaweb
define('DB_USER', 'entreescolhas1'); // usuário MySQL do Locaweb
define('DB_PASS', 'Entreescolhas1@'); // senha MySQL do Locaweb
define('DB_CHARSET', 'utf8mb4');

// Chave secreta para autenticar o admin — mude para algo aleatório longo
define('ADMIN_API_KEY', 'ec-admin-' . md5('entreescolhas2026secretkey'));

// Domínios permitidos para CORS (site na Vercel + local)
define('ALLOWED_ORIGINS', [
    'https://www.entreescolhas.com.br',
    'https://entreescolhas.com.br',
    'https://entreescolhas.vercel.app',
    'http://localhost',
    'http://127.0.0.1',
]);

// URL pública do site (sem barra no final) — usada para montar links em e-mails
define('APP_BASE_URL', 'https://www.entreescolhas.com.br');

// ── E-mail (Locaweb / SMTP) ──────────────────────────────────
// Preencha com os dados da caixa de e-mail da Locaweb que vai disparar os envios.
define('SMTP_HOST', 'email-ssl.com.br');      // host SMTP da Locaweb — confirme no painel
define('SMTP_PORT', 587);                     // 587 = STARTTLS (recomendado), 465 = SSL direto
define('SMTP_SECURE', 'tls');                 // 'tls' (porta 587) ou 'ssl' (porta 465)
define('SMTP_USER', 'PREENCHER@entreescolhas.com.br'); // caixa de e-mail completa
define('SMTP_PASS', 'PREENCHER_SENHA_DA_CAIXA');       // senha da caixa de e-mail
define('SMTP_FROM_NAME', 'Entre Escolhas');

// ── Mercado Pago (Checkout Pro) ──────────────────────────────
// Pegue em https://www.mercadopago.com.br/developers/panel/app
define('MP_ACCESS_TOKEN', 'PREENCHER_ACCESS_TOKEN_MERCADO_PAGO');
define('MP_PUBLIC_KEY', 'PREENCHER_PUBLIC_KEY_MERCADO_PAGO');
define('MP_REPORT_PRICE', 7.97);

// ── Regras de tentativa do teste ─────────────────────────────
// 1 tentativa original + 2 refações = 3 no total, por e-mail+jornada
define('MAX_TEST_ATTEMPTS', 3);

function getDB(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

function json(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function err(string $msg, int $status = 400): never {
    json(['error' => $msg], $status);
}

function requireApiKey(): void {
    $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['key'] ?? '';
    if ($key !== ADMIN_API_KEY) err('Unauthorized', 401);
}

function setCors(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, ALLOWED_ORIGINS, true)) {
        header("Access-Control-Allow-Origin: $origin");
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Api-Key');
    header('Access-Control-Max-Age: 86400');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}
