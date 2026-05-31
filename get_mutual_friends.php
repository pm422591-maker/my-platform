<?php
header('Content-Type: application/json');
session_start();
$host = 'my-mysql'; $db = 'mywebsite'; $user = 'root'; $pass = 'root';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false]); exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $my_id = $_SESSION['user_id'];

    // SQL запит на пошук взаємних друзів + підрахунок непрочитаних повідомлень
    $stmt = $pdo->prepare("
        SELECT u.id, u.username, u.avatar_url,
               (SELECT COUNT(id) FROM messages 
                WHERE sender_id = u.id 
                  AND receiver_id = ? 
                  AND is_read = 0) AS unread_count
        FROM user_follows f1
        JOIN user_follows f2 ON f1.follower_id = f2.followed_id AND f1.followed_id = f2.follower_id
        JOIN users u ON u.id = f1.followed_id
        WHERE f1.follower_id = ?
    ");
    
    // Зверни увагу: ми передаємо $my_id двічі. 
    // Перший — для receiver_id (хто отримує повідомлення), другий — для follower_id (чий список друзів).
    $stmt->execute([$my_id, $my_id]);
    $friends = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'friends' => $friends]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>