<?php
// apply_to_request.php — користувач відгукується на анкету (post_type = 'requests')
// Приймає: { post_id, comment }
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

// Захист від спаму відгуками
if (!checkRateLimit('apply_request', 20, 60)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Забагато відгуків. Зачекайте хвилину.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/applications_schema.php';

$applicantId = (int)$_SESSION['user_id'];

try {
    ensureApplicationsTable($pdo);

    $data = json_decode(file_get_contents("php://input"), true);
    $postId  = isset($data['post_id']) ? (int)$data['post_id'] : 0;
    $comment = isset($data['comment']) ? mb_substr(trim($data['comment']), 0, 500) : '';

    if ($postId <= 0) {
        echo json_encode(['success' => false, 'message' => 'Невірна анкета']);
        exit;
    }

    // Перевіряємо, що анкета існує, є заявкою і не наша власна
    $stmt = $pdo->prepare("SELECT user_id, post_type FROM posts WHERE id = ? LIMIT 1");
    $stmt->execute([$postId]);
    $post = $stmt->fetch();

    if (!$post) {
        echo json_encode(['success' => false, 'message' => 'Анкету не знайдено']);
        exit;
    }
    if ($post['post_type'] !== 'requests') {
        echo json_encode(['success' => false, 'message' => 'Це не анкета']);
        exit;
    }

    $ownerId = (int)$post['user_id'];
    if ($ownerId === $applicantId) {
        echo json_encode(['success' => false, 'message' => 'Не можна відгукнутись на власну анкету']);
        exit;
    }

    // Чи вже відгукувався?
    $chk = $pdo->prepare("SELECT id FROM post_applications WHERE post_id = ? AND applicant_id = ? LIMIT 1");
    $chk->execute([$postId, $applicantId]);
    if ($chk->fetch()) {
        echo json_encode(['success' => false, 'already' => true, 'message' => 'Ви вже відгукнулись на цю анкету']);
        exit;
    }

    $ins = $pdo->prepare("
        INSERT INTO post_applications (post_id, owner_id, applicant_id, comment, status, is_read)
        VALUES (?, ?, ?, ?, 'pending', 0)
    ");
    $ins->execute([$postId, $ownerId, $applicantId, ($comment !== '' ? $comment : null)]);

    echo json_encode(['success' => true, 'message' => 'Заявку відправлено']);

} catch (Exception $e) {
    error_log('apply_to_request error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}
