<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Ви не авторизовані']);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$post_id   = isset($data['post_id']) ? (int)$data['post_id'] : 0;
$gift_icon = isset($data['gift_icon']) ? trim($data['gift_icon']) : '';
$gift_id   = isset($data['gift_id']) ? trim($data['gift_id']) : '';
$cost      = isset($data['cost']) ? (int)$data['cost'] : 0;
$sender_id = (int)$_SESSION['user_id'];

if ($post_id === 0 || $gift_icon === '') {
    echo json_encode(['success' => false, 'message' => 'Недостатньо даних для подарунка']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // Гарантуємо додаткові колонки в post_gifts
    foreach ([
        "ALTER TABLE post_gifts ADD COLUMN sender_id INT NOT NULL DEFAULT 0",
        "ALTER TABLE post_gifts ADD COLUMN recipient_id INT NOT NULL DEFAULT 0",
        "ALTER TABLE post_gifts ADD COLUMN gift_id VARCHAR(50) DEFAULT NULL",
        "ALTER TABLE post_gifts ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ] as $alter) {
        try { $pdo->exec($alter); } catch (Exception $e) { /* колонка вже є */ }
    }

    // Одержувач = автор поста
    $recipient_id = 0;
    try {
        $pst = $pdo->prepare("SELECT user_id FROM posts WHERE id = ? LIMIT 1");
        $pst->execute([$post_id]);
        $recipient_id = (int)$pst->fetchColumn();
    } catch (Exception $e) { $recipient_id = 0; }

    $stmt = $pdo->prepare("
        INSERT INTO post_gifts (post_id, gift_icon, gift_id, sender_id, recipient_id)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$post_id, $gift_icon, ($gift_id !== '' ? $gift_id : null), $sender_id, $recipient_id]);

    if ($cost > 0) {
        try {
            $pdo->prepare("UPDATE users SET coins = GREATEST(0, coins - ?) WHERE id = ?")
                ->execute([$cost, $sender_id]);
        } catch (Exception $e) { /* колонки coins може не бути */ }
    }

    echo json_encode(['success' => true, 'recipient_id' => $recipient_id]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}