<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо зайві помилки, щоб не псувати JSON
error_reporting(0);
ini_set('display_errors', 0);

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql';   // Виправлено з 127.0.0.1
$db   = 'mywebsite';  // Ім'я твоєї бази
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';       // Пароль для Docker

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

// Отримуємо дані
$input = json_decode(file_get_contents('php://input'), true);
$start = $input['start'] ?? null;
$end = $input['end'] ?? null;

// Валідація: чи є це числами
if (!is_numeric($start) || !is_numeric($end)) {
    echo json_encode(['success' => false, 'message' => 'Некоректні дані (мають бути числа)']);
    exit;
}

try {
    // Підключення
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // [ОНОВЛЕННЯ] 
    // Записуємо години + оновлюємо час останньої зміни (NOW())
    $stmt = $pdo->prepare("UPDATE users SET status_start_hour = ?, status_end_hour = ?, status_last_updated = NOW() WHERE id = ?");
    $stmt->execute([$start, $end, $_SESSION['user_id']]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>