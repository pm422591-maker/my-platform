<?php
// get_owned_frames.php — список куплених ободків поточного користувача
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();
error_reporting(0);
ini_set('display_errors', 0);

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'owned' => []]);
    exit;
}

require_once __DIR__ . '/db_connect.php';

try {
    // Гарантуємо існування таблиці
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_avatar_frames (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            frame VARCHAR(100) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_frame (user_id, frame),
            KEY idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $stmt = $pdo->prepare("SELECT frame FROM user_avatar_frames WHERE user_id = ?");
    $stmt->execute([$userId]);
    $owned = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode(['success' => true, 'owned' => $owned]);

} catch (Exception $e) {
    error_log("[get_owned_frames] " . $e->getMessage());
    echo json_encode(['success' => false, 'owned' => []]);
}