<?php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

$host = 'my-mysql'; $db = 'mywebsite'; $user = 'root'; $pass = 'root'; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['comment_id'])) {
        echo json_encode(['success' => false, 'message' => 'Немає ID коментаря']); 
        exit;
    }

    $comment_id = intval($data['comment_id']);
    $action = isset($data['action']) ? $data['action'] : 'like'; 
    
    // Ідентифікація користувача
    $user_id = isset($data['user_id']) ? intval($data['user_id']) : 0;
    if ($user_id == 0 && isset($_SESSION['user_id'])) {
        $user_id = $_SESSION['user_id'];
    }

    if ($user_id == 0) {
        echo json_encode(['success' => false, 'message' => 'Потрібна авторизація']); 
        exit;
    }

    // === ЛОГІКА ПІД ТВОЮ БАЗУ (з vote_type) ===
    if ($action === 'unlike') {
        // Забираємо лайк (видаляємо запис)
        $stmt = $pdo->prepare("DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?");
        $stmt->execute([$comment_id, $user_id]);
    } else {
        // Ставимо лайк (vote_type = 1). Якщо вже є запис, оновлюємо завдяки твоєму індексу unique_vote
        $stmt = $pdo->prepare("INSERT INTO comment_votes (comment_id, user_id, vote_type) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE vote_type = 1");
        $stmt->execute([$comment_id, $user_id]);
    }

    // Перераховуємо всі сердечка (лайки) для цього коментаря
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM comment_votes WHERE comment_id = ? AND vote_type = 1");
    $stmt->execute([$comment_id]);
    $total_likes = $stmt->fetchColumn();

    // МИ БІЛЬШЕ НЕ ОНОВЛЮЄМО ТАБЛИЦЮ comments!
    // Просто повертаємо кількість лайків у JavaScript

    echo json_encode(['success' => true, 'total_likes' => $total_likes]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>