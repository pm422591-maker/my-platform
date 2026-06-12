<?php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();

$userId = $_SESSION['user_id'] ?? null;

if (!$userId) {
    echo json_encode(['success' => false, 'tutorial_done' => false, 'reason' => 'no_session']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

try {
    // Перевірка існування колонки (сумісно зі старим MySQL)
    $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'tutorial_done'")->fetchAll();
    if (empty($cols)) {
        echo json_encode(['success' => true, 'tutorial_done' => false, 'user_id' => $userId]);
        exit;
    }

    $stmt = $pdo->prepare("SELECT tutorial_done, quiz_done FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $done = $row && isset($row['tutorial_done']) && $row['tutorial_done'] == 1;

    echo json_encode([
        'success'       => true,
        'tutorial_done' => $done,
        'quiz_done'     => (bool)($row['quiz_done'] ?? false),
    ]);
} catch (Exception $e) {
    error_log("[get_tutorial_status] DB error: " . $e->getMessage());
    echo json_encode(['success' => false, 'tutorial_done' => false]);
}