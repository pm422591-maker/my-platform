<?php
session_start();
header('Content-Type: application/json');

// Налаштування БД (мають бути такі самі, як у get_user.php)
$host = 'my-mysql';
// Ім'я бази, яку ми вказали в environment (рядок 20)
$db   = 'mywebsite';
// Пароль root, який ми вказали (рядок 19)
$user = 'root';
$pass = 'root'; 

// 1. Перевірка авторизації
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Ви не авторизовані']);
    exit;
}

$userId = $_SESSION['user_id'];

// 2. Отримання даних від JS
$input = json_decode(file_get_contents('php://input'), true);
$colorLeft = $input['color_left'] ?? '#000000';
$colorRight = $input['color_right'] ?? '#ffffff';

// Валідація (щоб не зламали сайт)
if (!preg_match('/^#[a-f0-9]{6}$/i', $colorLeft) || !preg_match('/^#[a-f0-9]{6}$/i', $colorRight)) {
    echo json_encode(['success' => false, 'message' => 'Невірний формат кольору']);
    exit;
}

try {
    // 3. Підключення до БД
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // 4. Оновлення запису
    $stmt = $pdo->prepare("UPDATE users SET grad_color_left = ?, grad_color_right = ? WHERE id = ?");
    $stmt->execute([$colorLeft, $colorRight, $userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>