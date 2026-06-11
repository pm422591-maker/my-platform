<?php
// delete_comment.php — ВИПРАВЛЕНА ВЕРСІЯ
require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

// ── КРИТИЧНО: перевірка авторизації (була відсутня!)
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

$userId = (int)$_SESSION['user_id'];

require_once __DIR__ . '/db_connect.php';

$data = json_decode(file_get_contents('php://input'), true);

if (empty($data['comment_id'])) {
    echo json_encode(['success' => false, 'message' => 'Бракує даних']);
    exit;
}

$commentId = (int)$data['comment_id'];

try {
    // Видаляємо ТІЛЬКИ якщо user_id збігається (перевірка через БД, не через author_name!)
    // author_name — рядок, його можна підробити. user_id — число із сесії (безпечно).
    $stmt = $pdo->prepare("DELETE FROM comments WHERE id = ? AND user_id = ?");
    $stmt->execute([$commentId, $userId]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'Коментар не знайдено або немає доступу']);
    } else {
        echo json_encode(['success' => true]);
    }
} catch (Exception $e) {
    error_log('Delete comment error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}