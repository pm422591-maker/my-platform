<?php
// Вмикаємо помилки, щоб ти бачив, чому файл "не відкривається"
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
session_start();

$host = 'my-mysql'; $db = 'mywebsite'; $user = 'root'; $pass = 'root';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Ви не авторизовані']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $my_id = $_SESSION['user_id'];

    // Витягуємо ВСІХ підписників з бази (JOIN з таблицею users)
    $stmt = $pdo->prepare("
        SELECT u.id, u.username, u.avatar_url, f.created_at
        FROM user_follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.followed_id = ? 
        ORDER BY f.created_at DESC
    ");
    $stmt->execute([$my_id]);
    $followers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'followers' => $followers]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}