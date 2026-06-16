<?php
// register.php — ЗАХИЩЕНА ВЕРСІЯ
require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

// ── Rate limit: 5 реєстрацій / 10 хвилин на IP
if (!checkRateLimit('register', 5, 600)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Забагато спроб. Зачекайте 10 хвилин.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$data      = json_decode(file_get_contents('php://input'), true) ?? [];
$email     = trim($data['email'] ?? '');
$password  = $data['password'] ?? '';
$inputName = trim($data['username'] ?? (explode('@', $email)[0]));
$provider  = $data['provider'] ?? 'email';
$uid       = $data['uid'] ?? $email;

// ── Валідація
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => "Невірний email"]);
    exit;
}

if (strlen($email) > 255) {
    echo json_encode(['success' => false, 'message' => "Email занадто довгий"]);
    exit;
}

// Валідація імені користувача
$inputName = preg_replace('/[^\p{L}\p{N}_\- ]/u', '', $inputName);
$inputName = substr(trim($inputName), 0, 30);
if (strlen($inputName) < 2) {
    $inputName = 'User' . rand(1000, 9999);
}

// Для email-реєстрації перевіряємо пароль
if ($provider === 'email' && !isset($data['isLogin'])) {
    if (strlen($password) < 8) {
        echo json_encode(['success' => false, 'message' => 'Пароль мінімум 8 символів']);
        exit;
    }
    if (strlen($password) > 200) {
        echo json_encode(['success' => false, 'message' => 'Пароль занадто довгий']);
        exit;
    }
}

// ── provider whitelist
$allowedProviders = ['email', 'google', 'apple', 'roblox', 'steam'];
if (!in_array($provider, $allowedProviders, true)) {
    echo json_encode(['success' => false, 'message' => 'Невідомий провайдер']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, username, password, avatar_url, banner_url FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $existingUser = $stmt->fetch();

    if ($existingUser) {
        $isNew     = false;
        $userId    = $existingUser['id'];
        $finalName = $existingUser['username'];
        $avatar    = $existingUser['avatar_url'];
        $banner    = $existingUser['banner_url'];

        if ($provider === 'email' && !isset($data['isLogin'])) {
            echo json_encode(['success' => false, 'message' => 'Ця пошта вже зайнята']);
            exit;
        }

        if ($provider === 'email' && isset($data['isLogin'])) {
            if (!password_verify($password, $existingUser['password'])) {
                echo json_encode(['success' => false, 'message' => 'Невірний пароль']);
                exit;
            }
        }
    } else {
        $isNew = true;
        $pdo->beginTransaction();

        $hashedPassword = password_hash(
            $password ?: bin2hex(random_bytes(16)),
            PASSWORD_BCRYPT,
            ['cost' => 12]  // вища ціна = більш захищений хеш
        );

        $stmt1 = $pdo->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
        $stmt1->execute([$inputName, $email, $hashedPassword]);
        $userId = (int)$pdo->lastInsertId();

        // ── Стартова нагорода: безкоштовний бейдж 'vip' + монети ──
        // Гарантуємо наявність потрібних колонок (схема могла бути старою).
        try {
            $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('coins', $cols)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN coins INT NOT NULL DEFAULT 0");
            }
            if (!in_array('owned_badges', $cols)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN owned_badges TEXT NULL");
            }
            if (!in_array('badges', $cols)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN badges TEXT NULL");
            }
            // Видаємо стартовий безкоштовний бейдж + 100 монет
            $startCoins  = 100;
            $startBadge  = 'vip';
            $pdo->prepare(
                "UPDATE users SET coins = coins + ?, owned_badges = ?, badges = ? WHERE id = ?"
            )->execute([$startCoins, $startBadge, $startBadge, $userId]);
        } catch (Exception $rewardErr) {
            // Якщо нагорода не нарахувалась — реєстрацію все одно не валимо
            error_log('[register starter reward] ' . $rewardErr->getMessage());
        }

        // uid обрізаємо до 255 символів
        $uid = substr($uid, 0, 255);
        $stmt2 = $pdo->prepare("INSERT INTO user_auth (user_id, provider, provider_key) VALUES (?, ?, ?)");
        $stmt2->execute([$userId, $provider, $uid]);

        $pdo->commit();

        $finalName = $inputName;
        $avatar    = null;
        $banner    = null;
    }

    // ── Регенерація session ID
    session_regenerate_id(true);

    $_SESSION['user_id']   = (int)$userId;
    $_SESSION['user_name'] = $finalName;
    session_write_close();

    echo json_encode([
        'success'  => true,
        'username' => $finalName,
        'avatar'   => $avatar,
        'banner'   => $banner,
        'is_new'   => $isNew,
        // НЕ повертаємо email у відповіді — не потрібно клієнту
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Register error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}
