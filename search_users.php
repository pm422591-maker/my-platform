<?php
require_once 'db_connect.php'; 

header('Content-Type: application/json');

session_start();
// Отримуємо ID поточного користувача з сесії
$my_id = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : 0;
$query = isset($_GET['q']) ? trim($_GET['q']) : '';

try {
    if ($query === '' && $my_id > 0) {
        // --- СЦЕНАРІЙ 1: ВЗАЄМНІ ПІДПИСКИ ---
        // Використовуємо два знаки питання (?)
        $sql = "
            SELECT u.id, u.username, u.avatar_url AS avatar 
            FROM users u
            INNER JOIN user_follows f1 ON u.id = f1.followed_id AND f1.follower_id = ?
            INNER JOIN user_follows f2 ON u.id = f2.follower_id AND f2.followed_id = ?
            LIMIT 10
        ";
        $stmt = $pdo->prepare($sql);
        // Передаємо $my_id ДВА РАЗИ, бо в запиті два знаки питання
        $stmt->execute([$my_id, $my_id]);
        
    } else {
        // --- СЦЕНАРІЙ 2: ГЛОБАЛЬНИЙ ПОШУК ---
        $stmt = $pdo->prepare("SELECT id, username, avatar_url AS avatar FROM users WHERE username LIKE ? AND id != ? LIMIT 10");
        $stmt->execute(["%$query%", $my_id]);
    }

    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode([
        'success' => true,
        'users' => $users,
        'mode' => ($query === '' ? 'mutual' : 'global')
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage(), 'users' => []]);
}