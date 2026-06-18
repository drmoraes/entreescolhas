<?php
// ═══════════════════════════════════════════════════════════
// SETUP — Rode UMA VEZ para criar as tabelas no MySQL
// Acesse: https://api.entreescolhas.com.br/api/setup.php?key=SEU_ADMIN_KEY
// Depois DELETE ou renomeie este arquivo
// ═══════════════════════════════════════════════════════════
require_once __DIR__ . '/config.php';
setCors();
requireApiKey();

$db = getDB();

$db->exec("
CREATE TABLE IF NOT EXISTS candidates (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(255)   NOT NULL,
  email        VARCHAR(255)   NOT NULL,
  telefone     VARCHAR(30),
  cidade       VARCHAR(120),
  linkedin     VARCHAR(255),
  objetivo     VARCHAR(80),
  cargo        VARCHAR(150),
  empresa      VARCHAR(150),
  experiencia  VARCHAR(80),
  escolaridade VARCHAR(80),
  senioridade  VARCHAR(80),
  arquetipo    VARCHAR(80),
  arquetipo_scores JSON,
  pcd          TINYINT(1)     DEFAULT 0,
  pcd_tipo     VARCHAR(120),
  status       ENUM('novo','triagem','entrevista','aprovado','arquivado') DEFAULT 'novo',
  notes        TEXT,
  source       VARCHAR(80)    DEFAULT 'banco-de-talentos',
  consents     JSON,
  tags         JSON,
  created_at   DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email),
  KEY idx_status (status),
  KEY idx_objetivo (objetivo),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

$db->exec("
CREATE TABLE IF NOT EXISTS candidate_notes (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT UNSIGNED NOT NULL,
  note         TEXT         NOT NULL,
  author       VARCHAR(120) DEFAULT 'admin',
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

$db->exec("
CREATE TABLE IF NOT EXISTS candidate_status_log (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT UNSIGNED NOT NULL,
  from_status  VARCHAR(40),
  to_status    VARCHAR(40),
  changed_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

$db->exec("
CREATE TABLE IF NOT EXISTS leads (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome             VARCHAR(255)  NOT NULL,
  email            VARCHAR(255)  NOT NULL,
  jornada          VARCHAR(40)   NOT NULL DEFAULT 'arquetipo',
  confirm_token    VARCHAR(64)   NOT NULL,
  confirmed_at     DATETIME      NULL,
  access_token     VARCHAR(64)   NOT NULL,
  attempts_used    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  payment_status   ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  mp_preference_id VARCHAR(80),
  mp_payment_id    VARCHAR(80),
  report_json      JSON          NULL,
  report_sent_at   DATETIME      NULL,
  ip               VARCHAR(45),
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email_jornada (email, jornada),
  UNIQUE KEY uk_access_token (access_token),
  KEY idx_confirm_token (confirm_token),
  KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
");

json(['ok' => true, 'message' => 'Tabelas criadas com sucesso. Delete este arquivo agora.']);
