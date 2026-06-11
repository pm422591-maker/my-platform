<?php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: ''; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    $data = json_decode(file_get_contents('php://input'), true);
    $my_id = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : 0;
    $post_id = isset($data['post_id']) ? intval($data['post_id']) : 0;

    if ($my_id === 0) {
        echo json_encode(['success' => false, 'message' => 'Ви не залогінені']); exit;
    }

    // 1. Отримуємо автора поста
    $check = $pdo->prepare("SELECT user_id FROM posts WHERE id = ?");
    $check->execute([$post_id]);
    $db_author = $check->fetchColumn();

    // 2. ДОЗВОЛЯЄМО ВИДАЛЕННЯ, ЯКЩО:
    // - Ти і є автор (intval($db_author) === $my_id)
    // - АБО автора в базі взагалі немає ($db_author === false - пост зник, NULL або 0)
    if ($db_author === false || intval($db_author) === $my_id || intval($db_author) === 0 || $db_author === null) {
        
        $pdo->beginTransaction();
        
        // Видаляємо все за один раз
        $pdo->prepare("DELETE FROM posts WHERE id = ?")->execute([$post_id]);
        $pdo->prepare("DELETE FROM comments WHERE post_id = ?")->execute([$post_id]);
        $pdo->prepare("DELETE FROM post_votes WHERE post_id = ?")->execute([$post_id]);
        $pdo->prepare("DELETE FROM post_gifts WHERE post_id = ?")->execute([$post_id]);
        
        $pdo->commit();
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => "Це чужий пост. Ваш ID: $my_id, автор поста: $db_author"]);
    }

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}