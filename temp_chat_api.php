<?php
// temp_chat_api.php — керування тимчасовими чатами.
// action=list   → активні тимчасові чати поточного користувача (+ seconds_left, extend state)
// action=extend → поточний користувач голосує "Продовжити"; якщо обидва — +1 година
// action=check  → стан одного чату з конкретним користувачем (other_id)
require_once __DIR__ . '/cors_session.php';
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/temp_chats_schema.php';

$me = (int)$_SESSION['user_id'];

try {
    ensureTempChatsTable($pdo);
    cleanupExpiredTempChats($pdo); // чистимо прострочені при кожному зверненні

    // Дія може прийти і GET, і POST(json)
    $action = $_GET['action'] ?? '';
    $body = json_decode(file_get_contents("php://input"), true) ?: [];
    if (!$action && isset($body['action'])) $action = $body['action'];

    // ── СПИСОК активних тимчасових чатів ──
    if ($action === 'list') {
        $stmt = $pdo->prepare("
            SELECT tc.*,
                   GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), tc.expires_at)) AS seconds_left
            FROM temp_chats tc
            WHERE tc.user_a = ? OR tc.user_b = ?
        ");
        $stmt->execute([$me, $me]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $out = [];
        foreach ($rows as $r) {
            $otherId = ((int)$r['user_a'] === $me) ? (int)$r['user_b'] : (int)$r['user_a'];
            $myExtend    = ((int)$r['user_a'] === $me) ? (int)$r['extend_a'] : (int)$r['extend_b'];
            $otherExtend = ((int)$r['user_a'] === $me) ? (int)$r['extend_b'] : (int)$r['extend_a'];

            // Тягнемо ім'я та аватар співрозмовника
            $u = $pdo->prepare("SELECT username, avatar_url, avatar FROM users WHERE id = ? LIMIT 1");
            $u->execute([$otherId]);
            $usr = $u->fetch(PDO::FETCH_ASSOC) ?: [];

            $out[] = [
                'chat_id'      => (int)$r['id'],
                'other_id'     => $otherId,
                'username'     => $usr['username'] ?? ('user' . $otherId),
                'avatar_url'   => $usr['avatar_url'] ?? ($usr['avatar'] ?? null),
                'seconds_left' => (int)$r['seconds_left'],
                'my_extend'    => $myExtend,
                'other_extend' => $otherExtend,
            ];
        }
        echo json_encode(['success' => true, 'chats' => $out]);
        exit;
    }

    // ── ПЕРЕВІРКА стану чату з конкретним користувачем ──
    if ($action === 'check') {
        $otherId = isset($_GET['other_id']) ? (int)$_GET['other_id'] : (int)($body['other_id'] ?? 0);
        if ($otherId <= 0) { echo json_encode(['success' => false]); exit; }

        $stmt = $pdo->prepare("
            SELECT tc.*, GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), tc.expires_at)) AS seconds_left
            FROM temp_chats tc
            WHERE (tc.user_a = ? AND tc.user_b = ?) OR (tc.user_a = ? AND tc.user_b = ?)
            LIMIT 1
        ");
        $stmt->execute([$me, $otherId, $otherId, $me]);
        $r = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$r) { echo json_encode(['success' => true, 'is_temp' => false]); exit; }

        $myExtend    = ((int)$r['user_a'] === $me) ? (int)$r['extend_a'] : (int)$r['extend_b'];
        $otherExtend = ((int)$r['user_a'] === $me) ? (int)$r['extend_b'] : (int)$r['extend_a'];

        echo json_encode([
            'success'      => true,
            'is_temp'      => true,
            'chat_id'      => (int)$r['id'],
            'seconds_left' => (int)$r['seconds_left'],
            'my_extend'    => $myExtend,
            'other_extend' => $otherExtend,
        ]);
        exit;
    }

    // ── ПРОДОВЖИТИ (голос поточного користувача) ──
    if ($action === 'extend') {
        $otherId = isset($body['other_id']) ? (int)$body['other_id'] : (int)($_GET['other_id'] ?? 0);
        if ($otherId <= 0) { echo json_encode(['success' => false, 'message' => 'Немає співрозмовника']); exit; }

        $stmt = $pdo->prepare("
            SELECT * FROM temp_chats
            WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)
            LIMIT 1
        ");
        $stmt->execute([$me, $otherId, $otherId, $me]);
        $r = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$r) { echo json_encode(['success' => false, 'message' => 'Чат не знайдено']); exit; }

        $isA = ((int)$r['user_a'] === $me);
        // Ставимо голос поточного користувача
        if ($isA) {
            $pdo->prepare("UPDATE temp_chats SET extend_a = 1 WHERE id = ?")->execute([(int)$r['id']]);
            $extendA = 1; $extendB = (int)$r['extend_b'];
        } else {
            $pdo->prepare("UPDATE temp_chats SET extend_b = 1 WHERE id = ?")->execute([(int)$r['id']]);
            $extendA = (int)$r['extend_a']; $extendB = 1;
        }

        $bothAgreed = ($extendA === 1 && $extendB === 1);
        if ($bothAgreed) {
            // Подовжуємо на 1 годину і скидаємо голоси
            $pdo->prepare("
                UPDATE temp_chats
                SET expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR),
                    extend_a = 0, extend_b = 0
                WHERE id = ?
            ")->execute([(int)$r['id']]);
        }

        // Повертаємо актуальний стан
        $stmt2 = $pdo->prepare("SELECT *, GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), expires_at)) AS seconds_left FROM temp_chats WHERE id = ?");
        $stmt2->execute([(int)$r['id']]);
        $r2 = $stmt2->fetch(PDO::FETCH_ASSOC);
        $myExtend    = $isA ? (int)$r2['extend_a'] : (int)$r2['extend_b'];
        $otherExtend = $isA ? (int)$r2['extend_b'] : (int)$r2['extend_a'];

        echo json_encode([
            'success'      => true,
            'extended'     => $bothAgreed,
            'seconds_left' => (int)$r2['seconds_left'],
            'my_extend'    => $myExtend,
            'other_extend' => $otherExtend,
        ]);
        exit;
    }

    echo json_encode(['success' => false, 'message' => 'Невідома дія']);

} catch (Exception $e) {
    error_log('temp_chat_api error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}