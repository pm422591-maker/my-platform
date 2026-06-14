<?php
// admin_login.php — вхід адміністратора.
// Триступенева перевірка: пошта + основний пароль + ДОДАТКОВИЙ admin-пароль.
// Лише користувач з users.is_admin = 1 та правильним admin_pass_hash отримує доступ.

require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

// ── Жорсткий rate limit на вхід в адмінку
if (function_exists('checkRateLimit') && !checkRateLimit('admin_login', 5, 900)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Забагато спроб. Зачекайте 15 хвилин.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/moderation_schema.php';

$input     = json_decode(file_get_contents('php://input'), true) ?? [];
$email     = trim($input['email'] ?? '');
$password  = $input['password'] ?? '';
$adminPass = $input['admin_password'] ?? '';

if (!$email || !$password || !$adminPass) {
    echo json_encode(['success' => false, 'message' => 'Введіть пошту, пароль та адмін-пароль']);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Невірний формат email']);
    exit;
}
if (strlen($password) > 200 || strlen($adminPass) > 200) {
    echo json_encode(['success' => false, 'message' => 'Невірні дані']);
    exit;
}

try {
    ensureModerationSchema($pdo);

    $stmt = $pdo->prepare("
        SELECT id, username, password, is_admin, admin_pass_hash, status
        FROM users WHERE email = ? LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Захист від timing attack — завжди робимо verify
    $dummy = '$2y$10$invalidhashfortimingreasonsonly000000000000000000000';
    $mainOk  = password_verify($password,  $user['password']        ?? $dummy);
    $adminOk = password_verify($adminPass, ($user && $user['admin_pass_hash']) ? $user['admin_pass_hash'] : $dummy);
    $isAdmin = $user && (int)$user['is_admin'] === 1 && !empty($user['admin_pass_hash']);

    if ($user && $isAdmin && $mainOk && $adminOk) {
        if (($user['status'] ?? 'active') === 'banned') {
            echo json_encode(['success' => false, 'message' => 'Обліковий запис заблоковано']);
            exit;
        }
        session_regenerate_id(true);
        $_SESSION['user_id']        = (int)$user['id'];
        $_SESSION['user_name']      = $user['username'];
        $_SESSION['is_admin']       = 1;
        $_SESSION['admin_verified'] = 1; // позначка, що пройдено другий пароль

        // Журналюємо вхід
        $log = $pdo->prepare("INSERT INTO moderation_log (admin_id, action, details) VALUES (?, 'login', ?)");
        $log->execute([(int)$user['id'], 'IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown')]);

        echo json_encode(['success' => true, 'message' => 'Вхід в адмін-панель успішний', 'redirect' => 'admin.html']);
    } else {
        // Однакова відповідь для всіх помилок, щоб не розкривати, що саме не так
        echo json_encode(['success' => false, 'message' => 'Доступ заборонено: невірні дані']);
    }
} catch (Exception $e) {
    error_log('admin_login error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}
