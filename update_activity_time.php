<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

// --- ЄДИНЕ НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ---
$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$start = $input['start'] ?? null;
$end = $input['end'] ?? null;

if (!is_numeric($start) || !is_numeric($end)) {
    echo json_encode(['success' => false, 'message' => 'Некоректні дані (мають бути числа)']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $stmt = $pdo->prepare("UPDATE users SET status_start_hour = ?, status_end_hour = ?, status_last_updated = NOW() WHERE id = ?");
    $stmt->execute([$start, $end, $_SESSION['user_id']]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>