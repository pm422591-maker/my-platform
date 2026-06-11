<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

$host = 'my-mysql';
// Ім'я бази, яку ми вказали в environment (рядок 20)
$db   = 'mywebsite';
// Пароль root, який ми вказали (рядок 19)
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: ''; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    
    // Отримуємо дані з POST
    $bio = isset($_POST['bio']) ? trim($_POST['bio']) : '';

    // Валідація довжини (у тебе в БД varchar(231))
    if (mb_strlen($bio) > 231) {
        echo json_encode(['success' => false, 'message' => 'Опис занадто довгий']);
        exit;
    }
    
    $stmt = $pdo->prepare("UPDATE users SET bio = ? WHERE id = ?");
    $stmt->execute([$bio, $_SESSION['user_id']]);
    
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>