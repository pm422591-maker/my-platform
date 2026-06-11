<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

// Отримуємо дані з JavaScript
$data = json_decode(file_get_contents("php://input"), true);
$gif_url = isset($data['gif_url']) ? $data['gif_url'] : '';

if (!isset($_SESSION['user_id']) || empty($gif_url)) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано або порожня адреса']);
    exit;
}

$current_user_id = (int)$_SESSION['user_id'];

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Автоматично створюємо таблицю обраного, якщо її немає
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        gif_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // Перевіряємо, чи вже є ця гіфка в обраному цього юзера
    $check = $pdo->prepare("SELECT id FROM user_favorites WHERE user_id = ? AND gif_url = ?");
    $check->execute([$current_user_id, $gif_url]);
    $exists = $check->fetch();

    if ($exists) {
        // Якщо вже є — видаляємо (Toggle)
        $stmt = $pdo->prepare("DELETE FROM user_favorites WHERE user_id = ? AND gif_url = ?");
        $stmt->execute([$current_user_id, $gif_url]);
        echo json_encode(['success' => true, 'action' => 'removed']);
    } else {
        // Якщо немає — додаємо
        $stmt = $pdo->prepare("INSERT INTO user_favorites (user_id, gif_url) VALUES (?, ?)");
        $stmt->execute([$current_user_id, $gif_url]);
        echo json_encode(['success' => true, 'action' => 'added']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>