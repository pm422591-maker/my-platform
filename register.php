<?php
// 1. Налаштування CORS та заголовків
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true"); // 🔥 ОБЯЗАТЕЛЬНО для credentials: 'include'
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Налаштування сесії
$isSecure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
// Если используешь ngrok, он работает по HTTPS, но перенаправляет на локальный HTTP.
// Иногда нужно принудительно ставить true для ngrok:
$isSecure = true; // Оставь true, если ВСЕГДА используешь ngrok (https)

session_set_cookie_params([
    'lifetime' => 86400,
    'path' => '/',
    'secure' => $isSecure,     
    'httponly' => true,
    'samesite' => 'None'  // Работает только если secure = true!
]);
session_start();

// 3. Отримання даних
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root'; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $email = $data['email'] ?? '';
    $password = $data['password'] ?? ''; // Пароль з фронтенду
    $inputName = $data['username'] ?? explode('@', $email)[0];
    $provider = $data['provider'] ?? 'email';
    $uid = $data['uid'] ?? $email;

    if (!$email) throw new Exception("Email обов'язковий");

    // --- ПОШУК КОРИСТУВАЧА ---
    // Переконайся, що назви колонок у БД точно такі: avatar_url, banner_url
    $stmt = $pdo->prepare("SELECT id, username, password, avatar_url, banner_url FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existingUser) {
        // --- ЛОГІКА ДЛЯ ІСНУЮЧОГО КОРИСТУВАЧА ---
        $userId = $existingUser['id'];
        $finalName = $existingUser['username'];
        $avatar = $existingUser['avatar_url'];
        $banner = $existingUser['banner_url'];
        
        // Якщо це звичайна реєстрація (не Google), а пошта вже є
        if ($provider === 'email' && !isset($data['isLogin'])) {
             echo json_encode(['success' => false, 'message' => 'Ця пошта вже зайнята']);
             exit;
        }

        // Якщо це ЛОГІН через Email — перевіряємо пароль
        if ($provider === 'email' && isset($data['isLogin'])) {
            if (!password_verify($password, $existingUser['password'])) {
                echo json_encode(['success' => false, 'message' => 'Невірний пароль']);
                exit;
            }
        }
    } else {
        // --- РЕЄСТРАЦІЯ НОВОГО КОРИСТУВАЧА ---
        $pdo->beginTransaction();
        
        // Якщо пароль прийшов порожній (наприклад, Google), генеруємо випадковий
        $hashedPassword = password_hash($password ? $password : bin2hex(random_bytes(8)), PASSWORD_DEFAULT);

        $stmt1 = $pdo->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
        $stmt1->execute([$inputName, $email, $hashedPassword]);
        
        $userId = $pdo->lastInsertId();
        $finalName = $inputName;
        $avatar = null; 
        $banner = null;

        $stmt2 = $pdo->prepare("INSERT INTO user_auth (user_id, provider, provider_key) VALUES (?, ?, ?)");
        $stmt2->execute([$userId, $provider, $uid]);
        
        $pdo->commit();
    }

    // Зберігаємо в сесію
    $_SESSION['user_id'] = $userId;
    $_SESSION['user_name'] = $finalName;
    session_write_close();

    // Повертаємо ВСІ дані для localStorage
    echo json_encode([
        'success' => true, 
        'username' => $finalName,
        'avatar' => $avatar,
        'banner' => $banner,
        'email' => $email
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => 'Помилка: ' . $e->getMessage()]);
}
