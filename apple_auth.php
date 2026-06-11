<?php
// apple_auth.php — обробка входу через Apple ID (через Firebase)
// Логіка така сама як register.php для Google, бо Firebase вже верифікує токен

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

// Preflight (для CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();


$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'DB connection failed: ' . $e->getMessage()]);
    exit();
}

// Отримання даних від клієнта
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Немає даних']);
    exit();
}

$email    = trim($data['email']    ?? '');
$uid      = trim($data['uid']      ?? '');
$username = trim($data['username'] ?? '');
$provider = trim($data['provider'] ?? 'apple');

// Базова валідація
if (empty($uid)) {
    echo json_encode(['success' => false, 'message' => 'UID відсутній']);
    exit();
}

// Apple може не давати email після першого входу — генеруємо заглушку
if (empty($email)) {
    $email = $uid . '@privaterelay.appleid.com';
}

// Якщо username порожній — генеруємо з email
if (empty($username)) {
    $username = explode('@', $email)[0];
    // Робимо унікальним: додаємо 4 символи з uid
    $username = $username . '_' . substr($uid, 0, 4);
}

try {
    // Перевіряємо, чи існує юзер з таким uid або email
    $stmt = $pdo->prepare("SELECT * FROM users WHERE uid = :uid OR email = :email LIMIT 1");
    $stmt->execute([':uid' => $uid, ':email' => $email]);
    $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existingUser) {
        // ===== ЮЗЕР ВЖЕ ІСНУЄ — просто логінимо =====
        $_SESSION['user_id']   = $existingUser['id'];
        $_SESSION['user_name'] = $existingUser['username'];
        $_SESSION['uid']       = $existingUser['uid'];

        echo json_encode([
            'success'  => true,
            'message'  => 'Вхід успішний',
            'username' => $existingUser['username'],
            'avatar'   => $existingUser['avatar'] ?? '',
            'banner'   => $existingUser['banner'] ?? '',
        ]);

    } else {
        // ===== НОВИЙ ЮЗЕР — реєструємо =====

        // Перевірка унікальності username (може збігтися)
        $checkName = $pdo->prepare("SELECT id FROM users WHERE username = :username");
        $checkName->execute([':username' => $username]);
        if ($checkName->fetch()) {
            // Якщо ім'я зайняте — додаємо більше символів з uid
            $username = $username . '_' . substr($uid, 0, 6);
        }

        $defaultAvatar = 'img/avatars/default.png'; // шлях до дефолтного аватара

        $insert = $pdo->prepare("
            INSERT INTO users (uid, email, username, avatar, provider, created_at)
            VALUES (:uid, :email, :username, :avatar, :provider, NOW())
        ");
        $insert->execute([
            ':uid'      => $uid,
            ':email'    => $email,
            ':username' => $username,
            ':avatar'   => $defaultAvatar,
            ':provider' => $provider,
        ]);

        $newUserId = $pdo->lastInsertId();

        $_SESSION['user_id']   = $newUserId;
        $_SESSION['user_name'] = $username;
        $_SESSION['uid']       = $uid;

        echo json_encode([
            'success'  => true,
            'message'  => 'Реєстрація успішна',
            'username' => $username,
            'avatar'   => $defaultAvatar,
            'banner'   => '',
        ]);
    }

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}