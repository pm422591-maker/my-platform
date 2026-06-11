<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

// Отримуємо дані з JavaScript (POST запит)
$data = json_decode(file_get_contents("php://input"), true);
$target_id = isset($data['target_id']) ? (int)$data['target_id'] : 0;
$action = isset($data['action']) ? $data['action'] : 'block'; 

if (!isset($_SESSION['user_id']) || $target_id === 0) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано або відсутній ID']);
    exit;
}

$current_user_id = (int)$_SESSION['user_id'];

if ($current_user_id === $target_id) {
    echo json_encode(['success' => false, 'message' => 'Не можна заблокувати себе']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Автоматично створюємо таблицю блокувань, якщо її немає
    $pdo->exec("CREATE TABLE IF NOT EXISTS blocked_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        blocker_id INT NOT NULL,
        blocked_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_block (blocker_id, blocked_id)
    )");

    if ($action === 'block') {
        // 1. Записуємо блокування
        $stmt = $pdo->prepare("INSERT IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)");
        $stmt->execute([$current_user_id, $target_id]);

        // 2. Видаляємо з друзів / скасовуємо підписку в обох напрямках (з твоєї таблиці user_follows)
        $stmt_del = $pdo->prepare("DELETE FROM user_follows WHERE (follower_id = ? AND followed_id = ?) OR (follower_id = ? AND followed_id = ?)");
        $stmt_del->execute([$current_user_id, $target_id, $target_id, $current_user_id]);

        echo json_encode(['success' => true]);
    } 
    else if ($action === 'unblock') {
        // Розблоковуємо
        $stmt = $pdo->prepare("DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?");
        $stmt->execute([$current_user_id, $target_id]);
        
        echo json_encode(['success' => true]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>