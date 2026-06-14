<?php
// get_admin_messages.php — користувач отримує повідомлення від адміністрації
// (попередження, обмеження, бани) та може позначити їх прочитаними.
require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/moderation_schema.php';

if (empty($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

try {
    ensureModerationSchema($pdo);
    $uid = (int)$_SESSION['user_id'];

    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    // Позначити прочитаним
    if (($input['action'] ?? '') === 'mark_read') {
        $mid = (int)($input['message_id'] ?? 0);
        if ($mid > 0) {
            $s = $pdo->prepare("UPDATE admin_messages SET is_read = 1 WHERE id = ? AND user_id = ?");
            $s->execute([$mid, $uid]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // Поточний статус акаунта користувача (для показу банера обмежень/бану)
    $st = $pdo->prepare("SELECT status, restricted_until, ban_reason FROM users WHERE id = ? LIMIT 1");
    $st->execute([$uid]);
    $acct = $st->fetch();

    $stmt = $pdo->prepare("
        SELECT id, subject, body, is_read, created_at
        FROM admin_messages
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    ");
    $stmt->execute([$uid]);
    $messages = $stmt->fetchAll();

    $unread = 0;
    foreach ($messages as $m) { if (!$m['is_read']) $unread++; }

    echo json_encode([
        'success'  => true,
        'account'  => $acct ?: ['status' => 'active'],
        'unread'   => $unread,
        'messages' => $messages,
    ]);
} catch (Exception $e) {
    error_log('get_admin_messages error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}
