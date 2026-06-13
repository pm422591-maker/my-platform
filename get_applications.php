<?php
// get_applications.php — "пошта заявок" власника анкет.
// Повертає всі відгуки на анкети поточного користувача + лічильник нових.
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/applications_schema.php';

$ownerId = (int)$_SESSION['user_id'];

try {
    ensureApplicationsTable($pdo);

    // Тільки потрібний статус, якщо переданий (за замовч. — всі)
    $statusFilter = isset($_GET['status']) ? $_GET['status'] : 'all';
    $allowed = ['all', 'pending', 'accepted', 'rejected'];
    if (!in_array($statusFilter, $allowed, true)) $statusFilter = 'all';

    $sql = "
        SELECT a.id, a.post_id, a.applicant_id, a.comment, a.status, a.is_read, a.created_at,
               u.username AS applicant_name,
               u.avatar_url AS applicant_avatar,
               p.title AS post_title,
               p.body  AS post_body
        FROM post_applications a
        JOIN users u ON u.id = a.applicant_id
        JOIN posts p ON p.id = a.post_id
        WHERE a.owner_id = :owner
    ";
    if ($statusFilter !== 'all') {
        $sql .= " AND a.status = :st";
    }
    $sql .= " ORDER BY a.created_at DESC LIMIT 200";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':owner', $ownerId, PDO::PARAM_INT);
    if ($statusFilter !== 'all') {
        $stmt->bindValue(':st', $statusFilter, PDO::PARAM_STR);
    }
    $stmt->execute();
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Кількість нових (непрочитаних) заявок
    $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM post_applications WHERE owner_id = ? AND is_read = 0");
    $cntStmt->execute([$ownerId]);
    $unread = (int)$cntStmt->fetchColumn();

    echo json_encode([
        'success'      => true,
        'unread'       => $unread,
        'applications' => $applications,
    ]);

} catch (Exception $e) {
    error_log('get_applications error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}
