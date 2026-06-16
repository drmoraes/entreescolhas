<?php
// GET /api/export.php — exporta candidatos como CSV
require_once __DIR__ . '/config.php';
setCors();
requireApiKey();

$db = getDB();

$where  = ['1=1'];
$params = [];
if (!empty($_GET['status']))   { $where[] = 'status = ?';   $params[] = $_GET['status']; }
if (!empty($_GET['objetivo'])) { $where[] = 'objetivo = ?'; $params[] = $_GET['objetivo']; }
if (!empty($_GET['from']))     { $where[] = 'DATE(created_at) >= ?'; $params[] = $_GET['from']; }
if (!empty($_GET['to']))       { $where[] = 'DATE(created_at) <= ?'; $params[] = $_GET['to']; }

$sql = 'SELECT id,nome,email,telefone,cidade,linkedin,objetivo,cargo,empresa,
               experiencia,escolaridade,senioridade,arquetipo,pcd,status,
               notes,created_at
        FROM candidates WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

$filename = 'candidatos_' . date('Y-m-d') . '.csv';
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header("\xEF\xBB\xBF"); // UTF-8 BOM para Excel

$out = fopen('php://output', 'w');

fputcsv($out, [
    'ID','Nome','E-mail','Telefone','Cidade','LinkedIn','Objetivo',
    'Cargo','Empresa','Experiência','Escolaridade','Senioridade',
    'Arquétipo','PCD','Status','Notas','Cadastrado em'
], ';');

foreach ($rows as $r) {
    fputcsv($out, [
        $r['id'], $r['nome'], $r['email'], $r['telefone'], $r['cidade'],
        $r['linkedin'], $r['objetivo'], $r['cargo'], $r['empresa'],
        $r['experiencia'], $r['escolaridade'], $r['senioridade'],
        $r['arquetipo'], $r['pcd'] ? 'Sim' : 'Não',
        $r['status'], $r['notes'],
        date('d/m/Y H:i', strtotime($r['created_at']))
    ], ';');
}

fclose($out);
