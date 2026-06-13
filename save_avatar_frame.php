<?php
require_once __DIR__ . '/cors_session.php';
session_start();

header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $input = json_decode(file_get_contents('php://input'), true);
    $frame = $input['avatar_frame'] ?? '';

    // Whitelist allowed frames (only files from img/custom/)
    $allowed = ['', 'img/custom/frame_ender.webm', 'img/custom/frame_creeper.webm'];

    if (!in_array($frame, $allowed)) {
        echo json_encode(['success' => false, 'message' => 'Недопустима рамка']);
        exit;
    }

    $userId = $_SESSION['user_id'];

    // Ensure column exists (auto-migration)
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN avatar_frame VARCHAR(100) DEFAULT '' AFTER avatar_url");
    } catch (Exception $e) {
        // Column already exists — ignore
    }

    $stmt = $pdo->prepare("UPDATE users SET avatar_frame = ? WHERE id = ?");
    $stmt->execute([$frame, $userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>