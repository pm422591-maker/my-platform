<?php
// delete_session.php — видалення конкретної сесії пристрою.
// Поточну сесію видалити не можна (для цього є кнопка "Вийти").

require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/security_lib.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Увійдіть на сайт.']);
    exit;
}

$input     = json_decode(file_get_contents('php://input'), true) ?: [];
$sessionId = (int)($input['session_id'] ?? 0);
$userId    = (int)$_SESSION['user_id'];

if ($sessionId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Не вказано сесію.']);
    exit;
}

try {
    $pdo = sec_pdo();
    sec_ensure_schema($pdo);

    $currentToken = $_SESSION['device_token'] ?? '';

    // Перевіряємо, що сесія належить цьому користувачу
    $stmt = $pdo->prepare("SELECT session_token FROM user_sessions WHERE id = ? AND user_id = ?");
    $stmt->execute([$sessionId, $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Сесію не знайдено.']);
        exit;
    }

    if (hash_equals($currentToken, $row['session_token'])) {
        echo json_encode(['success' => false, 'message' => 'Не можна видалити поточну сесію. Скористайся кнопкою «Вийти».']);
        exit;
    }

    $pdo->prepare("DELETE FROM user_sessions WHERE id = ? AND user_id = ?")
        ->execute([$sessionId, $userId]);

    echo json_encode(['success' => true, 'message' => 'Сесію завершено.']);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка сервера.']);
}