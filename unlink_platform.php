<?php
// unlink_platform.php — відключення ігрового акаунта (Steam / Roblox / Epic)
// та повне стирання даних користувача по цій грі/платформі.

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Сесія не знайдена. Увійдіть на сайт.']);
    exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$platform = strtolower(trim($input['platform'] ?? ''));

// Дозволені платформи -> назва колонки з ID у таблиці users
$map = [
    'steam'  => 'steam_id',
    'roblox' => 'roblox_id',
    'epic'   => 'epic_id',
];

if (!isset($map[$platform])) {
    echo json_encode(['success' => false, 'message' => 'Невідома платформа.']);
    exit;
}

$idColumn = $map[$platform];
$userId   = $_SESSION['user_id'];

$host = getenv('DB_HOST') ?: 'my-mysql';
$db   = getenv('DB_NAME') ?: 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $pdo->beginTransaction();

    // 1. Прибираємо сам ID прив'язки -> акаунт вважається відключеним
    $stmt = $pdo->prepare("UPDATE users SET `$idColumn` = NULL WHERE id = ?");
    $stmt->execute([$userId]);

    // 2. Стираємо всі дані користувача по цій грі/платформі
    if ($platform === 'roblox') {
        // Інвентар Roblox зберігається прямо в users
        try {
            $pdo->prepare("UPDATE users SET roblox_inventory = NULL WHERE id = ?")->execute([$userId]);
        } catch (Exception $e) { /* колонки може не бути — ігноруємо */ }
    }

    // 3. Чистимо ігри користувача, пов'язані з цією платформою (таблиця user_games).
    //    Видаляємо записи, де назва гри належить цій платформі.
    //    За замовчуванням — видаляємо ВСІ ігри Roblox при відключенні Roblox і т.д.
    try {
        $like = '%' . $platform . '%';
        $stmt = $pdo->prepare(
            "DELETE FROM user_games WHERE user_id = ? AND LOWER(game_name) LIKE ?"
        );
        $stmt->execute([$userId, $like]);
    } catch (Exception $e) { /* таблиці може не бути */ }

    $pdo->commit();

    echo json_encode([
        'success'  => true,
        'platform' => $platform,
        'message'  => 'Акаунт відключено, дані по грі стерто.'
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}