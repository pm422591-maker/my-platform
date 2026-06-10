<?php
require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connect.php';

$data     = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$inputName = $data['username'] ?? (explode('@', $email)[0]);
$provider = $data['provider'] ?? 'email';
$uid      = $data['uid'] ?? $email;

if (!$email) {
    echo json_encode(['success' => false, 'message' => "Email обов'язковий"]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, username, password, avatar_url, banner_url FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $existingUser = $stmt->fetch();

    if ($existingUser) {
        $userId    = $existingUser['id'];
        $finalName = $existingUser['username'];
        $avatar    = $existingUser['avatar_url'];
        $banner    = $existingUser['banner_url'];

        // Email-реєстрація з вже зайнятою поштою (не логін)
        if ($provider === 'email' && !isset($data['isLogin'])) {
            echo json_encode(['success' => false, 'message' => 'Ця пошта вже зайнята']);
            exit;
        }

        // Email-логін — перевіряємо пароль
        if ($provider === 'email' && isset($data['isLogin'])) {
            if (!password_verify($password, $existingUser['password'])) {
                echo json_encode(['success' => false, 'message' => 'Невірний пароль']);
                exit;
            }
        }
    } else {
        // Реєстрація нового користувача
        $pdo->beginTransaction();

        $hashedPassword = password_hash(
            $password ?: bin2hex(random_bytes(8)),
            PASSWORD_DEFAULT
        );

        $stmt1 = $pdo->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
        $stmt1->execute([$inputName, $email, $hashedPassword]);
        $userId = $pdo->lastInsertId();

        $stmt2 = $pdo->prepare("INSERT INTO user_auth (user_id, provider, provider_key) VALUES (?, ?, ?)");
        $stmt2->execute([$userId, $provider, $uid]);

        $pdo->commit();

        $finalName = $inputName;
        $avatar    = null;
        $banner    = null;
    }

    $_SESSION['user_id']   = $userId;
    $_SESSION['user_name'] = $finalName;
    session_write_close();

    echo json_encode([
        'success'  => true,
        'username' => $finalName,
        'avatar'   => $avatar,
        'banner'   => $banner,
        'email'    => $email,
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => 'Помилка: ' . $e->getMessage()]);
}
?>
