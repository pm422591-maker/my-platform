<?php
// report.php — користувач надсилає скаргу на пост / коментар / акаунт.
require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/moderation_schema.php';

if (empty($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Потрібно увійти, щоб надіслати скаргу']);
    exit;
}

// ── Rate limit: щоб не спамили скаргами (якщо функція доступна)
if (function_exists('checkRateLimit') && !checkRateLimit('report', 20, 3600)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Забагато скарг. Спробуйте пізніше.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$targetType = $input['target_type'] ?? '';
$targetId   = (int)($input['target_id'] ?? 0);
$reasonCode = trim($input['reason_code'] ?? 'other');
$reasonText = trim($input['reason_text'] ?? '');
$targetUrl  = trim($input['target_url'] ?? '');

$allowedTypes = ['post', 'comment', 'account'];
if (!in_array($targetType, $allowedTypes, true) || $targetId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Невірні дані скарги']);
    exit;
}
if (mb_strlen($reasonText) > 1000) {
    $reasonText = mb_substr($reasonText, 0, 1000);
}
if (mb_strlen($reasonCode) > 60) {
    $reasonCode = mb_substr($reasonCode, 0, 60);
}

try {
    ensureModerationSchema($pdo);

    $reporterId   = (int)$_SESSION['user_id'];
    $targetUserId = null;
    $snapshot     = null;

    // Резолвимо власника об'єкта + робимо знімок змісту, щоб адмін бачив,
    // навіть якщо контент потім видалять.
    if ($targetType === 'account') {
        $targetUserId = $targetId;
        $s = $pdo->prepare("SELECT username FROM users WHERE id = ? LIMIT 1");
        $s->execute([$targetId]);
        $row = $s->fetch();
        if (!$row) { echo json_encode(['success' => false, 'message' => 'Користувача не знайдено']); exit; }
        $snapshot = 'Акаунт: @' . $row['username'];
    } elseif ($targetType === 'post') {
        $s = $pdo->prepare("SELECT user_id, content FROM posts WHERE id = ? LIMIT 1");
        $s->execute([$targetId]);
        $row = $s->fetch();
        if ($row) {
            $targetUserId = (int)$row['user_id'];
            $snapshot = mb_substr((string)($row['content'] ?? ''), 0, 500);
        }
    } elseif ($targetType === 'comment') {
        $s = $pdo->prepare("SELECT user_id, content FROM comments WHERE id = ? LIMIT 1");
        $s->execute([$targetId]);
        $row = $s->fetch();
        if ($row) {
            $targetUserId = (int)$row['user_id'];
            $snapshot = mb_substr((string)($row['content'] ?? ''), 0, 500);
        }
    }

    // Не дозволяємо скаржитись на самого себе
    if ($targetUserId !== null && $targetUserId === $reporterId) {
        echo json_encode(['success' => false, 'message' => 'Не можна поскаржитись на власний контент']);
        exit;
    }

    // Захист від дублів: одна активна скарга від користувача на той самий об'єкт
    $dup = $pdo->prepare("
        SELECT id FROM reports
        WHERE reporter_id = ? AND target_type = ? AND target_id = ?
          AND status IN ('pending','reviewing')
        LIMIT 1
    ");
    $dup->execute([$reporterId, $targetType, $targetId]);
    if ($dup->fetch()) {
        echo json_encode(['success' => true, 'message' => 'Ви вже надіслали скаргу на цей об\'єкт. Дякуємо!']);
        exit;
    }

    $stmt = $pdo->prepare("
        INSERT INTO reports
            (reporter_id, target_type, target_id, target_user_id, target_url, reason_code, reason_text, content_snapshot, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    ");
    $stmt->execute([
        $reporterId, $targetType, $targetId, $targetUserId,
        ($targetUrl !== '' ? mb_substr($targetUrl, 0, 500) : null),
        $reasonCode, ($reasonText !== '' ? $reasonText : null), $snapshot
    ]);

    echo json_encode(['success' => true, 'message' => 'Скаргу надіслано. Модерація розгляне її найближчим часом.']);

} catch (Exception $e) {
    error_log('report.php error: ' . $e->getMessage());
    // ТИМЧАСОВО: показуємо реальну причину для діагностики.
    // Прибрати після виправлення!
    echo json_encode([
        'success' => false,
        'message' => 'Помилка сервера. Спробуйте пізніше.',
        'debug'   => $e->getMessage(),
    ]);
}