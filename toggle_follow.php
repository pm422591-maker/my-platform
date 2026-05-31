<?php
// toggle_follow.php
header('Content-Type: application/json');
session_start();
$host = 'my-mysql'; $db = 'mywebsite'; $user = 'root'; $pass = 'root';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Авторизуйтесь']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $data = json_decode(file_get_contents('php://input'), true);

    $my_id = $_SESSION['user_id'];
    $target_id = intval($data['target_id']);

    if ($my_id === $target_id) exit(json_encode(['success' => false]));

    // Перевіряємо наявність підписки
    $check = $pdo->prepare("SELECT id FROM user_follows WHERE follower_id = ? AND followed_id = ?");
    $check->execute([$my_id, $target_id]);

    if ($check->fetch()) {
        $pdo->prepare("DELETE FROM user_follows WHERE follower_id = ? AND followed_id = ?")->execute([$my_id, $target_id]);
        $action = 'unfollowed';
    } else {
        $pdo->prepare("INSERT INTO user_follows (follower_id, followed_id) VALUES (?, ?)")->execute([$my_id, $target_id]);
        $action = 'followed';
    }

    // Рахуємо нову кількість підписників для миттєвого оновлення в JS
    $newCount = $pdo->prepare("SELECT COUNT(*) FROM user_follows WHERE followed_id = ?");
    $newCount->execute([$target_id]);

    echo json_encode([
        'success' => true, 
        'action' => $action, 
        'new_count' => $newCount->fetchColumn()
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}