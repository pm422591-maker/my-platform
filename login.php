<?php
require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connect.php';

$input    = json_decode(file_get_contents('php://input'), true);
$email    = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (!$email || !$password) {
    echo json_encode(['success' => false, 'message' => 'Введіть пошту та пароль']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, username, password, avatar_url, banner_url FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['user_id']   = $user['id'];
        $_SESSION['user_name'] = $user['username'];

        echo json_encode([
            'success'  => true,
            'message'  => 'Вхід успішний',
            'username' => $user['username'],
            'avatar'   => $user['avatar_url'],
            'banner'   => $user['banner_url'],
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Невірна пошта або пароль']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка сервера: ' . $e->getMessage()]);
}
?>
