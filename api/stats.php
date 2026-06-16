<?php
// GET /api/stats.php — dashboard metrics
require_once __DIR__ . '/config.php';
setCors();
requireApiKey();

$db = getDB();

// Total por status
$byStatus = $db->query('SELECT status, COUNT(*) as cnt FROM candidates GROUP BY status')->fetchAll();

// Total por objetivo
$byObj = $db->query('SELECT objetivo, COUNT(*) as cnt FROM candidates GROUP BY objetivo ORDER BY cnt DESC')->fetchAll();

// Total por senioridade
$bySen = $db->query('SELECT senioridade, COUNT(*) as cnt FROM candidates WHERE senioridade != "" GROUP BY senioridade ORDER BY cnt DESC')->fetchAll();

// Total por arquétipo
$byArch = $db->query('SELECT arquetipo, COUNT(*) as cnt FROM candidates WHERE arquetipo IS NOT NULL GROUP BY arquetipo ORDER BY cnt DESC')->fetchAll();

// Crescimento últimos 30 dias (por dia)
$growth = $db->query('
    SELECT DATE(created_at) as day, COUNT(*) as cnt
    FROM candidates
    WHERE created_at >= NOW() - INTERVAL 30 DAY
    GROUP BY DATE(created_at)
    ORDER BY day ASC
')->fetchAll();

// Recentes (últimos 5)
$recent = $db->query('
    SELECT id, nome, email, objetivo, arquetipo, status, created_at
    FROM candidates ORDER BY created_at DESC LIMIT 5
')->fetchAll();

// Totais gerais
$totals = $db->query('
    SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = "novo" THEN 1 ELSE 0 END) AS novo,
        SUM(CASE WHEN status = "triagem" THEN 1 ELSE 0 END) AS triagem,
        SUM(CASE WHEN status = "entrevista" THEN 1 ELSE 0 END) AS entrevista,
        SUM(CASE WHEN status = "aprovado" THEN 1 ELSE 0 END) AS aprovado,
        SUM(CASE WHEN status = "arquivado" THEN 1 ELSE 0 END) AS arquivado,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS last_7d,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS last_30d
    FROM candidates
')->fetch();

json([
    'totals'    => $totals,
    'by_status' => $byStatus,
    'by_objetivo' => $byObj,
    'by_senioridade' => $bySen,
    'by_arquetipo' => $byArch,
    'growth_30d' => $growth,
    'recent'    => $recent,
]);
