<?php
// 1. Налаштування CORS та заголовків
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true"); 
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Автоматичне визначення безпечного з'єднання (HTTPS)
$isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
            (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

session_set_cookie_params([
    'lifetime' => 86400,
    'path' => '/',
    'secure' => $isSecure, // Тепер автоматично буде true на https://syncora.cyou
    'httponly' => true,
    'samesite' => $isSecure ? 'None' : 'Lax' // Якщо HTTPS немає (localhost) — ставимо Lax, якщо є — None
]);
session_start();
header('Content-Type: application/json');

// Підключення до БД (копія з register.php)
$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    if (!$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'Введіть пошту та пароль']);
        exit;
    }

    // 1. Шукаємо користувача за поштою
    $stmt = $pdo->prepare("SELECT id, username, password, avatar_url, banner_url FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // 2. Якщо користувач є і пароль підходить
    if ($user && password_verify($password, $user['password'])) {
        
        // Записуємо в сесію
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_name'] = $user['username'];
        
        echo json_encode([
            'success' => true,
            'message' => 'Вхід успішний',
            'username' => $user['username'],
            'avatar' => $user['avatar_url'],
            'banner' => $user['banner_url'] // Повертаємо, щоб JS міг зберегти
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Невірна пошта або пароль']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка сервера: ' . $e->getMessage()]);
}
?>