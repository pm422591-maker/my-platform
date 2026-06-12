<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Налаштування CORS (копія з login.php)
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
            (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

session_set_cookie_params([
    'lifetime' => 86400,
    'path'     => '/',
    'secure'   => $isSecure,
    'httponly' => true,
    'samesite' => $isSecure ? 'None' : 'Lax'
]);
session_start();
header('Content-Type: application/json; charset=utf-8');

try {
    if (!function_exists('curl_init')) {
        throw new Exception('Бібліотека cURL не встановлена або вимкнена у PHP!');
    }

    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Сесія не знайдена. Увійдіть на сайт.']);
        exit;
    }

    // -------------------------------------------------------
    // 1. Читаємо код авторизації від JS
    // -------------------------------------------------------
    $json         = file_get_contents('php://input');
    $request_data = json_decode($json, true);

    if (!$request_data || !isset($request_data['code'])) {
        throw new Exception('Код авторизації не отримано. Що прийшло: ' . $json);
    }

    $authCode = $request_data['code'];

    // -------------------------------------------------------
    // 2. Ключі та redirect_uri
    //    redirect_uri визначається динамічно — не хардкодимо домен.
    //    Переконайся, що цей URI зареєстрований у Roblox Creator Hub!
    // -------------------------------------------------------
    $client_id     = '3297832364838545643';
    $client_secret = 'RBX-z6LMMDaBo0ydp7J9OFOkXrw_DkNWsQmUm4UEKbyCST2jdA3Hpx3885ljFCsSv0ky';

    $scheme       = $isSecure ? 'https' : 'http';
    $host         = $_SERVER['HTTP_HOST'];
    $redirect_uri = $scheme . '://' . $host . '/profile.html';

    // -------------------------------------------------------
    // 3. Обмін коду на токен
    // -------------------------------------------------------
    $token_url  = 'https://apis.roblox.com/oauth/v1/token';
    $post_fields = http_build_query([
        'client_id'     => $client_id,
        'client_secret' => $client_secret,
        'grant_type'    => 'authorization_code',
        'code'          => $authCode,
        'redirect_uri'  => $redirect_uri
    ]);

    $ch = curl_init($token_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_fields);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $token_response = curl_exec($ch);
    $token_error    = curl_error($ch);
    curl_close($ch);

    if ($token_error) {
        throw new Exception('cURL помилка (токен): ' . $token_error);
    }

    $token_data = json_decode($token_response, true);

    if (!isset($token_data['access_token'])) {
        // Повертаємо деталі щоб легше дебажити
        echo json_encode([
            'success' => false,
            'message' => 'Roblox відхилив запит токена',
            'details' => $token_data,
            'redirect_uri_used' => $redirect_uri  // Допомагає порівняти з тим що в Creator Hub
        ]);
        exit;
    }

    $access_token = $token_data['access_token'];

    // -------------------------------------------------------
    // 4. Отримуємо профіль користувача Roblox
    // -------------------------------------------------------
    $userinfo_url = 'https://apis.roblox.com/oauth/v1/userinfo';
    $ch2 = curl_init($userinfo_url);
    curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch2, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $access_token]);
    curl_setopt($ch2, CURLOPT_TIMEOUT, 10);

    $userinfo_response = curl_exec($ch2);
    $userinfo_error    = curl_error($ch2);
    curl_close($ch2);

    if ($userinfo_error) {
        throw new Exception('cURL помилка (профіль): ' . $userinfo_error);
    }

    $roblox_user = json_decode($userinfo_response, true);

    if (!isset($roblox_user['sub'])) {
        echo json_encode(['success' => false, 'message' => 'Немає даних акаунта', 'details' => $roblox_user]);
        exit;
    }

    // -------------------------------------------------------
    // 5. Зберігаємо Roblox ID в БД
    // -------------------------------------------------------
    // ВИПРАВЛЕНО: без хардкоду root/root — логін/пароль з environment
    $pdo = new PDO(
        "mysql:host=" . (getenv('DB_HOST') ?: 'my-mysql') . ";dbname=" . (getenv('DB_NAME') ?: 'mywebsite') . ";charset=utf8",
        getenv('DB_USER') ?: 'appuser',
        getenv('DB_PASS') ?: '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $stmt = $pdo->prepare("UPDATE users SET roblox_id = ? WHERE id = ?");
    $stmt->execute([$roblox_user['sub'], $_SESSION['user_id']]);

    echo json_encode([
        'success' => true,
        'data'    => $roblox_user
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Критична помилка PHP: ' . $e->getMessage(),
        'line'    => $e->getLine()
    ]);
}
?>