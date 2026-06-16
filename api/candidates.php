<?php
// ═══════════════════════════════════════════════════════════
// GET  /api/candidates.php          — lista com filtros
// GET  /api/candidates.php?id=N     — candidato individual + notas + log
// PUT  /api/candidates.php          — atualizar status/notes/tags
// DELETE /api/candidates.php?id=N   — arquivar (soft delete)
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
setCors();
requireApiKey();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET único ────────────────────────────────────────────
if ($method === 'GET' && isset($_GET['id'])) {
    $id  = (int) $_GET['id'];
    $db  = getDB();
    $row = $db->prepare('SELECT * FROM candidates WHERE id = ?');
    $row->execute([$id]);
    $c   = $row->fetch();
    if (!$c) err('Not found', 404);

    // notas
    $n = $db->prepare('SELECT * FROM candidate_notes WHERE candidate_id = ? ORDER BY created_at DESC');
    $n->execute([$id]);
    $c['notes_list'] = $n->fetchAll();

    // log de status
    $l = $db->prepare('SELECT * FROM candidate_status_log WHERE candidate_id = ? ORDER BY changed_at DESC LIMIT 20');
    $l->execute([$id]);
    $c['status_log'] = $l->fetchAll();

    // decodifica JSON columns
    foreach (['consents','arquetipo_scores','tags'] as $col) {
        if (isset($c[$col]) && is_string($c[$col])) {
            $c[$col] = json_decode($c[$col], true);
        }
    }
    json($c);
}

// ── GET lista ─────────────────────────────────────────────
if ($method === 'GET') {
    $db = getDB();

    $where  = ['1=1'];
    $params = [];

    if (!empty($_GET['status']))   { $where[] = 'status = ?';   $params[] = $_GET['status']; }
    if (!empty($_GET['objetivo'])) { $where[] = 'objetivo = ?'; $params[] = $_GET['objetivo']; }
    if (!empty($_GET['senioridade'])) { $where[] = 'senioridade = ?'; $params[] = $_GET['senioridade']; }
    if (!empty($_GET['arquetipo'])) { $where[] = 'arquetipo = ?'; $params[] = $_GET['arquetipo']; }
    if (!empty($_GET['cidade']))   { $where[] = 'cidade LIKE ?'; $params[] = '%' . $_GET['cidade'] . '%'; }

    if (!empty($_GET['q'])) {
        $q = '%' . $_GET['q'] . '%';
        $where[] = '(nome LIKE ? OR email LIKE ? OR cargo LIKE ? OR empresa LIKE ?)';
        array_push($params, $q, $q, $q, $q);
    }

    // data range
    if (!empty($_GET['from'])) { $where[] = 'DATE(created_at) >= ?'; $params[] = $_GET['from']; }
    if (!empty($_GET['to']))   { $where[] = 'DATE(created_at) <= ?'; $params[] = $_GET['to']; }

    $sort_col = in_array($_GET['sort'] ?? '', ['nome','email','created_at','status','senioridade']) ? $_GET['sort'] : 'created_at';
    $sort_dir = ($_GET['dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';

    $page  = max(1, (int) ($_GET['page'] ?? 1));
    $limit = min(100, max(10, (int) ($_GET['limit'] ?? 30)));
    $offset = ($page - 1) * $limit;

    $whereSQL = implode(' AND ', $where);

    $total = $db->prepare("SELECT COUNT(*) FROM candidates WHERE $whereSQL");
    $total->execute($params);
    $count = (int) $total->fetchColumn();

    $stmt = $db->prepare("
        SELECT id, nome, email, telefone, cidade, objetivo, cargo, empresa,
               senioridade, arquetipo, status, created_at, updated_at
        FROM candidates
        WHERE $whereSQL
        ORDER BY $sort_col $sort_dir
        LIMIT $limit OFFSET $offset
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    json([
        'total'    => $count,
        'page'     => $page,
        'limit'    => $limit,
        'pages'    => (int) ceil($count / $limit),
        'data'     => $rows,
    ]);
}

// ── PUT — atualizar candidato ─────────────────────────────
if ($method === 'PUT') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || !isset($body['id'])) err('ID obrigatório');

    $id  = (int) $body['id'];
    $db  = getDB();

    // Fetch atual para log de status
    $cur = $db->prepare('SELECT status FROM candidates WHERE id = ?');
    $cur->execute([$id]);
    $row = $cur->fetch();
    if (!$row) err('Not found', 404);

    $fields = [];
    $params = [];

    $allowed = ['status','cargo','empresa','cidade','senioridade','arquetipo','tags','objetivo'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "$f = ?";
            $params[] = is_array($body[$f]) ? json_encode($body[$f]) : $body[$f];
        }
    }

    if ($fields) {
        $fields[] = 'updated_at = NOW()';
        $params[]  = $id;
        $db->prepare('UPDATE candidates SET ' . implode(', ', $fields) . ' WHERE id = ?')
           ->execute($params);

        // Log mudança de status
        if (isset($body['status']) && $body['status'] !== $row['status']) {
            $db->prepare('INSERT INTO candidate_status_log (candidate_id, from_status, to_status) VALUES (?,?,?)')
               ->execute([$id, $row['status'], $body['status']]);
        }
    }

    // Adicionar nota
    if (!empty($body['note'])) {
        $db->prepare('INSERT INTO candidate_notes (candidate_id, note, author) VALUES (?,?,?)')
           ->execute([$id, trim($body['note']), $body['author'] ?? 'admin']);
    }

    json(['ok' => true]);
}

// ── DELETE — arquivar ─────────────────────────────────────
if ($method === 'DELETE' && isset($_GET['id'])) {
    $id = (int) $_GET['id'];
    $db = getDB();
    $db->prepare('UPDATE candidates SET status = "arquivado", updated_at = NOW() WHERE id = ?')
       ->execute([$id]);
    json(['ok' => true]);
}

err('Method not allowed', 405);
