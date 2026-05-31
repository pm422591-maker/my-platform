<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

// 1. Перевірка авторизації
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

// 2. Отримуємо дані від JavaScript
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['message_id']) || !isset($data['text'])) {
    echo json_encode(['success' => false, 'message' => 'Немає даних для оновлення.']);
    exit;
}

$msgId = (int)$data['message_id'];
$newText = trim($data['text']);
$userId = $_SESSION['user_id'];

if (empty($newText)) {
    echo json_encode(['success' => false, 'message' => 'Текст не може бути порожнім.']);
    exit;
}

// 3. Підключення та оновлення БД
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // ВАЖЛИВО: Я використовую стандартні назви для чату (таблиця messages, колонки message та sender_id).
    // Якщо у тебе колонка автора називається user_id замість sender_id, просто зміни її тут:
    $stmt = $pdo->prepare("UPDATE messages SET message = ? WHERE id = ? AND sender_id = ?");
    $stmt->execute([$newText, $msgId, $userId]);

    // Якщо все окей
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>