<?php
session_start();
header('Content-Type: application/json');

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql';  // Виправлено з 127.0.0.1
$db   = 'mywebsite'; // Перевір: якщо помилка, спробуй 'gamer_db'
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';      // Виправлено з "" на "root"

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit;
}

// Отримуємо кольори з JSON
$input = json_decode(file_get_contents('php://input'), true);
$userId = $_SESSION['user_id'];
$colorLeft = $input['color_left'] ?? '#222222';
$colorRight = $input['color_right'] ?? '#000000';

try {
    // Підключення
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Оновлення бази
    $stmt = $pdo->prepare("UPDATE users SET grad_color_left = ?, grad_color_right = ? WHERE id = ?");
    $stmt->execute([$colorLeft, $colorRight, $userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    // Якщо помилка - показуємо її
    echo json_encode(['success' => false, 'message' => 'DB Error: ' . $e->getMessage()]);
}
?>