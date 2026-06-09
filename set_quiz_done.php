<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$isSecure = true;
session_set_cookie_params([
    'lifetime' => 86400,
    'path' => '/',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'None'
]);
session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Not authorized', 'reason' => 'no_session']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=my-mysql;dbname=mywebsite;charset=utf8", 'root', 'root', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    // Ensure column exists (compatible with older MySQL that lacks IF NOT EXISTS for ADD COLUMN)
    $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'tutorial_done'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN tutorial_done TINYINT(1) NOT NULL DEFAULT 0");
    }

    $stmt = $pdo->prepare("UPDATE users SET tutorial_done = 1 WHERE id = ?");
    $stmt->execute([$userId]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    error_log("[set_tutorial_done] error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}