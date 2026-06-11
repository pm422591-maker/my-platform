<?php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: ''; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['post_id'])) {
        echo json_encode(['success' => false, 'message' => 'Немає ID поста']); 
        exit;
    }

    $post_id = intval($data['post_id']);
    $action = isset($data['action']) ? $data['action'] : 'like'; 
    
    $user_id = isset($data['user_id']) ? intval($data['user_id']) : 0;
    if ($user_id == 0 && isset($_SESSION['user_id'])) {
        $user_id = $_SESSION['user_id'];
    }

    if ($user_id == 0) {
        echo json_encode(['success' => false, 'message' => 'Потрібна авторизація']); 
        exit;
    }

    // ЛОГІКА ДЛЯ ТАБЛИЦІ post_votes
    if ($action === 'unlike') {
        $stmt = $pdo->prepare("DELETE FROM post_votes WHERE post_id = ? AND user_id = ?");
        $stmt->execute([$post_id, $user_id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO post_votes (post_id, user_id, vote_type) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE vote_type = 1");
        $stmt->execute([$post_id, $user_id]);
    }

    // Рахуємо всі сердечка
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM post_votes WHERE post_id = ? AND vote_type = 1");
    $stmt->execute([$post_id]);
    $total_likes = $stmt->fetchColumn();

    // Розумне оновлення: пробуємо записати в таблицю posts, якщо є колонка
    try {
        $stmt = $pdo->prepare("UPDATE posts SET vote_count = ? WHERE id = ?");
        $stmt->execute([$total_likes, $post_id]);
    } catch (Exception $e) {
        // Якщо колонки vote_count у таблиці posts немає - нічого страшного, просто йдемо далі
    }

    echo json_encode(['success' => true, 'total_likes' => $total_likes]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>