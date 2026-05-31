<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо зайві помилки
error_reporting(0);
ini_set('display_errors', 0);

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $userId = $_SESSION['user_id'];

    // 1. (Опціонально) Можна спочатку отримати старий файл і видалити його з папки
    // Але для простоти ми просто очистимо запис у БД
    
    // 2. Оновлюємо базу: ставимо avatar_url = NULL
    $stmt = $pdo->prepare("UPDATE users SET avatar_url = NULL WHERE id = ?");
    $stmt->execute([$userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>