<?php
// respond_application.php — власник анкети приймає / відхиляє заявку,
// або позначає всі заявки прочитаними.
// Приймає: { application_id, action }  де action = accept | reject | mark_read_all
require_once __DIR__ . '/cors_session.php';
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/applications_schema.php';
require_once __DIR__ . '/temp_chats_schema.php';

$ownerId = (int)$_SESSION['user_id'];

try {
    ensureApplicationsTable($pdo);
    ensureTempChatsTable($pdo);

    $data   = json_decode(file_get_contents("php://input"), true);
    $action = isset($data['action']) ? trim($data['action']) : '';

    // Позначити всі як прочитані (коли власник відкрив пошту заявок)
    if ($action === 'mark_read_all') {
        $stmt = $pdo->prepare("UPDATE post_applications SET is_read = 1 WHERE owner_id = ? AND is_read = 0");
        $stmt->execute([$ownerId]);
        echo json_encode(['success' => true]);
        exit;
    }

    $appId = isset($data['application_id']) ? (int)$data['application_id'] : 0;
    if ($appId <= 0 || !in_array($action, ['accept', 'reject'], true)) {
        echo json_encode(['success' => false, 'message' => 'Невірні дані']);
        exit;
    }

    // Перевіряємо, що заявка адресована саме цьому власнику
    $chk = $pdo->prepare("SELECT applicant_id, post_id FROM post_applications WHERE id = ? AND owner_id = ? LIMIT 1");
    $chk->execute([$appId, $ownerId]);
    $appRow = $chk->fetch();
    if (!$appRow) {
        echo json_encode(['success' => false, 'message' => 'Заявку не знайдено']);
        exit;
    }

    $newStatus = ($action === 'accept') ? 'accepted' : 'rejected';
    $upd = $pdo->prepare("UPDATE post_applications SET status = ?, is_read = 1 WHERE id = ? AND owner_id = ?");
    $upd->execute([$newStatus, $appId, $ownerId]);

    // ── При ПРИЙНЯТТІ створюємо тимчасовий чат (1 година) ──
    if ($action === 'accept') {
        $applicantId = (int)$appRow['applicant_id'];
        $postId      = (int)$appRow['post_id'];
        if ($applicantId > 0 && $applicantId !== $ownerId) {
            // user_a = власник, user_b = той хто відгукнувся
            // ON DUPLICATE: якщо чат уже існував — оновлюємо термін і скидаємо голоси
            $ins = $pdo->prepare("
                INSERT INTO temp_chats (user_a, user_b, post_id, expires_at, extend_a, extend_b)
                VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), 0, 0)
                ON DUPLICATE KEY UPDATE
                    expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR),
                    extend_a = 0, extend_b = 0,
                    post_id = VALUES(post_id)
            ");
            $ins->execute([$ownerId, $applicantId, $postId]);
        }
    }

    echo json_encode(['success' => true, 'status' => $newStatus]);

} catch (Exception $e) {
    error_log('respond_application error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}