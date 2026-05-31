<?php
header("Access-Control-Allow-Origin: http://localhost:8080");
header("Access-Control-Allow-Credentials: true");
header('Content-Type: application/json; charset=utf-8');

// Вмикаємо відображення помилок, щоб легше було бачити баги в консолі
ini_set('display_errors', 1);
error_reporting(E_ALL);

session_start();

$host = 'my-mysql';
$db = 'mywebsite'; 
$user = 'root'; 
$pass = 'root'; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4" // Додай цей рядок для надійності
]);

    // Отримуємо JSON-дані
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data || empty($data['post_id'])) {
        echo json_encode(['success' => false, 'message' => 'Немає ID поста']);
        exit;
    }

    $post_id = intval($data['post_id']);
    $body = !empty($data['body']) ? trim($data['body']) : '';
    $sticker = !empty($data['sticker']) ? $data['sticker'] : null;
    $parent_id = isset($data['parent_id']) ? intval($data['parent_id']) : 0;

    // Дані користувача з сесії
    $user_id = $_SESSION['user_id'] ?? 0;
    $author = $_SESSION['user_name'] ?? 'Гість';
    $avatar = $_SESSION['user_avatar'] ?? 'img/default_avatar.png';

    // ВАЖЛИВО: Переконайся, що назви колонок у БД точно такі:
    // post_id, user_id, author_name, avatar_url, body, parent_id, sticker_url
    $sql = "INSERT INTO comments (post_id, user_id, author_name, avatar_url, body, parent_id, sticker_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $post_id, 
        $user_id, 
        $author, 
        $avatar, 
        $body, 
        $parent_id, 
        $sticker
    ]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(500);
    // Це повідомлення про помилку з'явиться у вкладці Network -> Response
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>