<?php
header('Content-Type: application/json; charset=utf-8');
session_start();

error_reporting(0);
ini_set('display_errors', 0);

// УВАГА: Переконайся, що хост тут такий самий, як і в інших файлах!
$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) { 
    echo json_encode([]); 
    exit; 
}

$my_id = (int)$_SESSION['user_id'];
$friend_id = isset($_GET['friend_id']) ? (int)$_GET['friend_id'] : 0;

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $stmt = $pdo->prepare("
        SELECT * FROM messages 
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
          AND (deleted_by IS NULL OR deleted_by != ?)
        ORDER BY created_at ASC
    ");
    
    // Передаємо 5 параметрів, як і домовлялись
    $stmt->execute([$my_id, $friend_id, $friend_id, $my_id, $my_id]);
    $messages = $stmt->fetchAll();

    // === ДОДАЄМО is_me ДЛЯ JAVASCRIPT ===
    $result = [];
    foreach ($messages as $msg) {
        $msg['is_me'] = ($msg['sender_id'] == $my_id) ? true : false;
        $result[] = $msg;
    }

    echo json_encode($result);

} catch (Exception $e) {
    // Якщо помилка - повертаємо порожній масив, щоб не ламати JS
    echo json_encode([]);
}
?>