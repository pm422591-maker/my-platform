<?php
// check_my_applications.php — повертає список post_id, на які поточний юзер
// вже відгукнувся (щоб кнопка одразу показувала стан "Заявку відправлено").
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => true, 'applied' => []]); // не авторизований — порожньо
    exit;
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/applications_schema.php';

$applicantId = (int)$_SESSION['user_id'];

try {
    ensureApplicationsTable($pdo);

    $stmt = $pdo->prepare("SELECT post_id, status FROM post_applications WHERE applicant_id = ?");
    $stmt->execute([$applicantId]);

    $applied = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $applied[(string)$row['post_id']] = $row['status'];
    }

    echo json_encode(['success' => true, 'applied' => $applied]);

} catch (Exception $e) {
    error_log('check_my_applications error: ' . $e->getMessage());
    echo json_encode(['success' => true, 'applied' => []]);
}
