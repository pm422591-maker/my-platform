<?php
// Налаштування CORS (копія з login.php)
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");

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

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Сесія не знайдена. Увійдіть на сайт.']);
    exit;
}

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

// -------------------------------------------------------
// 1. Перевіряємо що Steam взагалі повернув дані
// -------------------------------------------------------
if (!isset($_GET['openid_claimed_id']) || !isset($_GET['openid_sig'])) {
    echo json_encode(['success' => false, 'message' => 'Дані від Steam відсутні.']);
    exit;
}

// -------------------------------------------------------
// 2. ВЕРИФІКАЦІЯ ПІДПИСУ — запит назад до Steam
//    Без цього будь-хто міг підробити чужий Steam ID!
// -------------------------------------------------------
$params = $_GET;
$params['openid.mode'] = 'check_authentication'; // Змінюємо mode для перевірки

// Формуємо тіло запиту: всі openid_ параметри → openid.
$postFields = [];
foreach ($params as $key => $value) {
    $newKey = str_replace('openid_', 'openid.', $key);
    $postFields[$newKey] = $value;
}

$ch = curl_init('https://steamcommunity.com/openid/login');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$verifyResponse = curl_exec($ch);
$curlError      = curl_error($ch);
curl_close($ch);

if ($curlError) {
    echo json_encode(['success' => false, 'message' => 'Помилка зв\'язку зі Steam: ' . $curlError]);
    exit;
}

// Steam повертає текстову відповідь з рядком "is_valid:true" або "is_valid:false"
if (strpos($verifyResponse, 'is_valid:true') === false) {
    echo json_encode(['success' => false, 'message' => 'Steam відхилив верифікацію підпису. Спробуйте ще раз.']);
    exit;
}

// -------------------------------------------------------
// 3. Витягуємо Steam64 ID з підтвердженого claimed_id
// -------------------------------------------------------
preg_match(
    '/^https?:\/\/steamcommunity\.com\/openid\/id\/(7[0-9]{15,25})$/',
    $_GET['openid_claimed_id'],
    $matches
);

if (empty($matches[1])) {
    echo json_encode(['success' => false, 'message' => 'Не вдалося розпізнати Steam ID.']);
    exit;
}

$steamId = $matches[1];
$userId  = $_SESSION['user_id'];

// -------------------------------------------------------
// 4. Зберігаємо в БД
// -------------------------------------------------------
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $stmt = $pdo->prepare("UPDATE users SET steam_id = ? WHERE id = ?");
    $stmt->execute([$steamId, $userId]);

    echo json_encode([
        'success'  => true,
        'steam_id' => $steamId,
        'message'  => 'Steam акаунт успішно прив\'язано!'
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>