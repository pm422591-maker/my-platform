<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id']) || !isset($_GET['target_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано або відсутній ID']);
    exit;
}

$my_id = (int)$_SESSION['user_id'];
$target_id = (int)$_GET['target_id'];

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    
    // ПЕРЕВІРКА ЗА ТВОЄЮ СТРУКТУРОЮ (user_follows / followed_id)
    $stmt1 = $pdo->prepare("SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ? AND followed_id = ?");
    $stmt1->execute([$my_id, $target_id]);
    $i_follow = $stmt1->fetch()['count'] > 0;

    $stmt2 = $pdo->prepare("SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ? AND followed_id = ?");
    $stmt2->execute([$target_id, $my_id]);
    $he_follows = $stmt2->fetch()['count'] > 0;

    echo json_encode([
        'success' => true,
        'is_mutual' => ($i_follow && $he_follows),
        'debug' => [
            'i_follow_him' => $i_follow,
            'he_follows_me' => $he_follows
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>