<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо помилки для чистого JSON
error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Ви не авторизовані']);
    exit;
}

// Отримуємо JSON дані від JS
$json = file_get_contents('php://input');
$data = json_decode($json, true);

$post_id = isset($data['post_id']) ? (int)$data['post_id'] : 0;
$gift_icon = isset($data['gift_icon']) ? trim($data['gift_icon']) : '';

if ($post_id === 0 || empty($gift_icon)) {
    echo json_encode(['success' => false, 'message' => 'Недостатньо даних для подарунка']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // Записуємо подарунок у базу
    $stmt = $pdo->prepare("INSERT INTO post_gifts (post_id, gift_icon) VALUES (?, ?)");
    $stmt->execute([$post_id, $gift_icon]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>