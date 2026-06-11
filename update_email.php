<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо зайві попередження, щоб не ламати JSON
error_reporting(0);
ini_set('display_errors', 0);

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql';  // БУЛО 'db', СТАЛО 'my-mysql'
$db   = 'mywebsite'; // Переконайся, що в phpMyAdmin база називається саме так
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';      // Стандартний пароль

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Перевірка авторизації
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Ви не авторизовані']);
        exit;
    }
    
    $userId = $_SESSION['user_id'];
    
    // Отримуємо дані від JS
    $input = json_decode(file_get_contents('php://input'), true);
    $newEmail = $input['email'] ?? null;

    // Валідація: чи є email і чи схожий він на email
    if (!$newEmail) {
        echo json_encode(['success' => false, 'message' => 'Email не вказано']);
        exit;
    }

    // Оновлюємо саме колонку secondary_email (як на твоєму скриншоті №11)
    $stmt = $pdo->prepare("UPDATE users SET secondary_email = ? WHERE id = ?");
    $result = $stmt->execute([$newEmail, $userId]);

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>