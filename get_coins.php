<?php
// get_coins.php — Получить текущий баланс монет и статус Premium из БД
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$isSecure = true;
session_set_cookie_params([
    'lifetime' => 86400,
    'path'     => '/',
    'secure'   => $isSecure,
    'httponly' => true,
    'samesite' => 'None'
]);
session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'coins' => 0, 'premium_active' => false]);
    exit;
}

try {
    $pdo = new PDO(
        "mysql:host=my-mysql;dbname=mywebsite;charset=utf8mb4",
        'root', 'root',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    // Проверяем наличие колонок (на случай старой схемы БД)
    $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    
    $selectCoins   = in_array('coins', $cols)         ? 'coins'         : '0 AS coins';
    $selectPremium = in_array('premium_until', $cols) ? 'premium_until' : 'NULL AS premium_until';

    $stmt = $pdo->prepare("SELECT {$selectCoins}, {$selectPremium} FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    $coins = $row ? (int)$row['coins'] : 0;
    $premiumUntil = $row['premium_until'] ?? null;
    $premiumActive = false;

    if ($premiumUntil) {
        $premiumActive = (new DateTime($premiumUntil)) > new DateTime();
    }

    echo json_encode([
        'success'        => true,
        'coins'          => $coins,
        'premium_active' => $premiumActive,
        'premium_until'  => $premiumUntil
    ]);

} catch (Exception $e) {
    error_log("[get_coins] error: " . $e->getMessage());
    echo json_encode(['success' => false, 'coins' => 0, 'premium_active' => false, 'message' => $e->getMessage()]);
}
