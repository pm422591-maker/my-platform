<?php
// login.php — ЗАХИЩЕНА ВЕРСІЯ
require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

// ── Rate limit: 10 спроб / 15 хвилин на IP
if (!checkRateLimit('login', 10, 900)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Забагато спроб. Зачекайте 15 хвилин.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$input    = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

// ── Валідація вхідних даних
if (!$email || !$password) {
    echo json_encode(['success' => false, 'message' => 'Введіть пошту та пароль']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Невірний формат email']);
    exit;
}

if (strlen($password) > 200) {
    echo json_encode(['success' => false, 'message' => 'Невірний пароль']);
    exit;
}

try {
    $stmt = $pdo->prepare(
        "SELECT id, username, password, avatar_url, banner_url FROM users WHERE email = ? LIMIT 1"
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Перевіряємо пароль незалежно від того, чи є юзер — захист від timing attack
    $dummyHash = '$2y$10$invalidhashfortimingreasonsonly000000000000000000000';
    $hashToVerify = $user ? $user['password'] : $dummyHash;
    $passwordOk   = password_verify($password, $hashToVerify);

    if ($user && $passwordOk) {
        // ── Регенерація session ID після логіну (захист від session fixation)
        session_regenerate_id(true);

        $_SESSION['user_id']   = (int)$user['id'];
        $_SESSION['user_name'] = $user['username'];

        echo json_encode([
            'success'  => true,
            'message'  => 'Вхід успішний',
            'username' => $user['username'],
            'avatar'   => $user['avatar_url'],
            'banner'   => $user['banner_url'],
        ]);
    } else {
        // Однакове повідомлення для відсутнього юзера і неправильного пароля
        echo json_encode(['success' => false, 'message' => 'Невірна пошта або пароль']);
    }
} catch (Exception $e) {
    error_log('Login error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}
