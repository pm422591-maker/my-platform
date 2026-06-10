<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/cors_session.php';
session_start();

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $userId = (int)$_SESSION['user_id'];

    // Отримуємо старий файл, щоб видалити його з диску
    $stmt = $pdo->prepare("SELECT avatar_url FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row && $row['avatar_url'] && str_starts_with($row['avatar_url'], 'uploads/')) {
        $filePath = __DIR__ . '/' . $row['avatar_url'];
        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    // Оновлюємо базу: ставимо avatar_url = NULL
    $stmt = $pdo->prepare("UPDATE users SET avatar_url = NULL WHERE id = ?");
    $stmt->execute([$userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>
