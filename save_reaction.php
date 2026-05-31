<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

// Перевірка авторизації
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

// Отримуємо JSON-дані від нашого JavaScript
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['message_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не передано ID повідомлення']);
    exit;
}

$message_id = (int)$data['message_id'];
$reaction = isset($data['reaction']) ? trim($data['reaction']) : '';

try {
    // Твоє підключення до бази даних
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Зберігаємо реакцію в базу
    // ВАЖЛИВО: Якщо твоя таблиця з повідомленнями називається не 'messages', 
    // а наприклад 'chat_messages', зміни назву в запиті нижче.
    $stmt = $pdo->prepare("UPDATE messages SET reaction = ? WHERE id = ?");
    $stmt->execute([$reaction, $message_id]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>