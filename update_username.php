<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

// Перевірка сесії — ДО підключення до БД
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

$userId = $_SESSION['user_id'];

$input   = json_decode(file_get_contents('php://input'), true);
$newName = isset($input['username']) ? trim($input['username']) : null;

if (!$newName) {
    echo json_encode(['success' => false, 'message' => 'Нікнейм не може бути порожнім']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // Перевірка унікальності нікнейму
    $check = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
    $check->execute([$newName, $userId]);
    if ($check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Цей нікнейм вже зайнятий']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE users SET username = ? WHERE id = ?");
    $stmt->execute([$newName, $userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>