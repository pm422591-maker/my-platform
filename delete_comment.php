<?php
header("Access-Control-Allow-Origin: http://localhost:8080");
header("Access-Control-Allow-Credentials: true");
header('Content-Type: application/json; charset=utf-8');
session_start();

$host = 'my-mysql'; $db = 'mywebsite'; $user = 'root'; $pass = 'root'; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['comment_id']) || empty($data['author_name'])) {
        echo json_encode(['success' => false, 'message' => 'Бракує даних']); exit;
    }

    // Видаляємо коментар (або відповідь) ТІЛЬКИ якщо автор збігається
    $stmt = $pdo->prepare("DELETE FROM comments WHERE id = ? AND author_name = ?");
    $stmt->execute([$data['comment_id'], $data['author_name']]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>