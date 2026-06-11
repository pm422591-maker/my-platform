<?php
session_start(); // Обов'язково стартуємо сесію!
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

// РОЗУМНА ПЕРЕВІРКА: 
// 1. Беремо ID з URL (якщо дивимось чужий профіль)
// 2. Або беремо ID з сесії (якщо дивимось свій профіль)
$userId = $_GET['user_id'] ?? $_SESSION['user_id'] ?? 0;

if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Немає ID користувача']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $stmt = $pdo->prepare("SELECT title, slug FROM blogs WHERE user_id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $blog = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($blog) {
        echo json_encode([
            'success' => true, 
            'blog_title' => $blog['title'],
            'blog_slug' => $blog['slug']
        ]);
    } else {
        echo json_encode(['success' => true, 'blog_title' => null]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>