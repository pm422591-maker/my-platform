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
    // 🛡️ ФІКС: переконуємось, що ОБИДВІ колонки існують.
    // Раніше перевірялась тільки tutorial_done, а SELECT тягнув ще й quiz_done —
    // якщо її не було, запит падав з "Unknown column 'quiz_done'",
    // success ставав false і туторіал вискакував при КОЖНОМУ вході.
    $needCols = ['tutorial_done', 'quiz_done'];
    foreach ($needCols as $col) {
        $exists = $pdo->query("SHOW COLUMNS FROM users LIKE '$col'")->fetchAll();
        if (empty($exists)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN $col TINYINT(1) NOT NULL DEFAULT 0");
        }
    }

    $stmt = $pdo->prepare("SELECT tutorial_done, quiz_done FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'       => true,
        'tutorial_done' => (bool)($row['tutorial_done'] ?? false),
        'quiz_done'     => (bool)($row['quiz_done'] ?? false),
    ]);
} catch (Exception $e) {
    error_log("[get_tutorial_status] DB error: " . $e->getMessage());
    // 🛡️ НЕ віддаємо текст SQL-помилки клієнту і повідомляємо причину 'db_error',
    // щоб фронтенд НЕ запускав туторіал через тимчасову проблему з БД.
    echo json_encode(['success' => false, 'tutorial_done' => false, 'reason' => 'db_error']);
}
