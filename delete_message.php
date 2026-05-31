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

// 2. Отримуємо дані
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['message_id'])) {
    echo json_encode(['success' => false, 'message' => 'Немає ID повідомлення.']);
    exit;
}

$msgId = (int)$data['message_id'];
$userId = $_SESSION['user_id'];

// 3. Підключення та видалення
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // ВАЖЛИВО: Обов'язково перевіряємо sender_id (або user_id), щоб ніхто не міг видалити ЧУЖЕ повідомлення
    $stmt = $pdo->prepare("DELETE FROM messages WHERE id = ? AND sender_id = ?");
    $stmt->execute([$msgId, $userId]);

    // Перевіряємо, чи дійсно рядок було видалено з бази
    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Повідомлення не знайдено, або це не ваше повідомлення.']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>