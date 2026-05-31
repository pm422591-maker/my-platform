<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

if (!isset($_SESSION['user_id'])) {
    echo json_encode([]);
    exit;
}

$current_user_id = (int)$_SESSION['user_id'];

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Вибираємо всі гіфки користувача
    $stmt = $pdo->prepare("SELECT gif_url FROM user_favorites WHERE user_id = ? ORDER BY id DESC");
    $stmt->execute([$current_user_id]);
    
    // Повертаємо тільки масив посилань
    $favorites = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode($favorites);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД']);
}
?>