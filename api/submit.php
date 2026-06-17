<?php
// ═══════════════════════════════════════════════════════════
// POST /api/submit.php — recebe cadastro do banco de talentos
// Sem autenticação (público) — valida dados internamente
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
setCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Method not allowed', 405);

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) err('Invalid JSON');

// ── Validação básica ─────────────────────────────────────
$nome  = trim($data['nome'] ?? '');
$email = strtolower(trim($data['email'] ?? ''));

if (strlen($nome) < 2) err('Nome obrigatório');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) err('E-mail inválido');
if (!($data['consents']['termos'] ?? false)) err('Aceite dos Termos de Uso obrigatório');
if (!($data['consents']['privacidade'] ?? false)) err('Aceite da Política de Privacidade obrigatório');
if (!($data['consents']['lgpd'] ?? false)) err('Consentimento LGPD obrigatório');

// ── Rate limit simples via IP (10 req/hora) ──────────────
$ip   = $_SERVER['REMOTE_ADDR'];
$file = sys_get_temp_dir() . '/ec_rl_' . md5($ip) . '.json';
$now  = time();
$rl   = file_exists($file) ? json_decode(file_get_contents($file), true) : ['ts' => $now, 'count' => 0];
if ($now - $rl['ts'] > 3600) { $rl = ['ts' => $now, 'count' => 0]; }
$rl['count']++;
file_put_contents($file, json_encode($rl));
if ($rl['count'] > 10) err('Muitas tentativas. Tente novamente em uma hora.', 429);

// ── Persistir ────────────────────────────────────────────
$db = getDB();

// Verificar duplicata
$chk = $db->prepare('SELECT id, status FROM candidates WHERE email = ?');
$chk->execute([$email]);
$existing = $chk->fetch();

if ($existing) {
    // Atualizar dados (pode ter feito o teste de novo etc.)
    $stmt = $db->prepare('
        UPDATE candidates SET
            nome=?, telefone=?, cidade=?, linkedin=?,
            objetivo=?, cargo=?, empresa=?, experiencia=?,
            escolaridade=?, senioridade=?,
            arquetipo=?, arquetipo_scores=?,
            pcd=?, pcd_tipo=?, consents=?,
            updated_at=NOW()
        WHERE email=?
    ');
    $stmt->execute([
        $nome,
        sanitizePhone($data['telefone'] ?? ''),
        trim($data['cidade'] ?? ''),
        trim($data['linkedin'] ?? ''),
        $data['objetivo'] ?? '',
        trim($data['cargo'] ?? ''),
        trim($data['empresa'] ?? ''),
        $data['experiencia'] ?? '',
        $data['escolaridade'] ?? '',
        $data['senioridade'] ?? '',
        $data['arquetipo'] ?? null,
        isset($data['arquetipo_scores']) ? json_encode($data['arquetipo_scores']) : null,
        ($data['pcd'] ?? false) ? 1 : 0,
        trim($data['pcd_tipo'] ?? ''),
        json_encode($data['consents'] ?? []),
        $email,
    ]);
    json(['ok' => true, 'id' => $existing['id'], 'updated' => true]);
}

// Inserir novo
$stmt = $db->prepare('
    INSERT INTO candidates
        (nome, email, telefone, cidade, linkedin, objetivo,
         cargo, empresa, experiencia, escolaridade, senioridade,
         arquetipo, arquetipo_scores, pcd, pcd_tipo, consents, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
');
$stmt->execute([
    $nome,
    $email,
    sanitizePhone($data['telefone'] ?? ''),
    trim($data['cidade'] ?? ''),
    trim($data['linkedin'] ?? ''),
    $data['objetivo'] ?? '',
    trim($data['cargo'] ?? ''),
    trim($data['empresa'] ?? ''),
    $data['experiencia'] ?? '',
    $data['escolaridade'] ?? '',
    $data['senioridade'] ?? '',
    $data['arquetipo'] ?? null,
    isset($data['arquetipo_scores']) ? json_encode($data['arquetipo_scores']) : null,
    ($data['pcd'] ?? false) ? 1 : 0,
    trim($data['pcd_tipo'] ?? ''),
    json_encode($data['consents'] ?? []),
    'banco-de-talentos',
]);

$id = (int) $db->lastInsertId();
json(['ok' => true, 'id' => $id, 'updated' => false]);

function sanitizePhone(string $p): string {
    $digits = preg_replace('/\D/', '', $p);
    if (strlen($digits) === 11) {
        return '(' . substr($digits,0,2) . ') ' . substr($digits,2,5) . '-' . substr($digits,7);
    }
    if (strlen($digits) === 10) {
        return '(' . substr($digits,0,2) . ') ' . substr($digits,2,4) . '-' . substr($digits,6);
    }
    return $p;
}
