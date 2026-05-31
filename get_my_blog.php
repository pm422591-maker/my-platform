<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'has_blog' => false]);
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

    $userId = $_SESSION['user_id'];

    $stmt = $pdo->prepare("SELECT * FROM blogs WHERE user_id = ?");
    $stmt->execute([$userId]);
    $blog = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($blog) {
        echo json_encode([
            'success' => true, 
            'has_blog' => true, 
            'blog' => [
                'id' => $blog['id'],
                'title' => $blog['title'],
                'description' => $blog['description'],
                'privacy' => $blog['privacy'],
                'bg_color' => $blog['bg_color'],
                'slug' => $blog['slug'],
                'bg_image' => $blog['bg_image'] // Віддаємо шлях до картинки
            ]
        ]);
    } else {
        echo json_encode(['success' => true, 'has_blog' => false]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД']);
}
?>