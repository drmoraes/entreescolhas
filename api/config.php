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

// Domínios permitidos para CORS (site no Netlify + local)
define('ALLOWED_ORIGINS', [
    'https://www.entreescolhas.com.br',
    'https://entreescolhas.com.br',
    'http://localhost',
    'http://127.0.0.1',
]);

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
