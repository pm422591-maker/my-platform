<?php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Not authorized', 'reason' => 'no_session']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

try {
    // Переконуємось, що колонка існує
    $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'tutorial_done'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN tutorial_done TINYINT(1) NOT NULL DEFAULT 0");
    }

    $stmt = $pdo->prepare("UPDATE users SET tutorial_done = 1 WHERE id = ?");
    $stmt->execute([$userId]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    error_log("[set_tutorial_done] error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}