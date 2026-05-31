<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

$target_id = isset($_GET['target_id']) ? (int)$_GET['target_id'] : 0;

if (!isset($_SESSION['user_id']) || $target_id === 0) {
    echo json_encode(['success' => false, 'i_blocked_him' => false, 'he_blocked_me' => false]);
    exit;
}

$current_user_id = (int)$_SESSION['user_id'];

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // Чи Я заблокував його?
    $stmt1 = $pdo->prepare("SELECT COUNT(*) as count FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?");
    $stmt1->execute([$current_user_id, $target_id]);
    $i_blocked_him = $stmt1->fetch()['count'] > 0;

    // Чи ВІН заблокував мене?
    $stmt2 = $pdo->prepare("SELECT COUNT(*) as count FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?");
    $stmt2->execute([$target_id, $current_user_id]);
    $he_blocked_me = $stmt2->fetch()['count'] > 0;

    echo json_encode([
        'success' => true,
        'i_blocked_him' => $i_blocked_him,
        'he_blocked_me' => $he_blocked_me
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>