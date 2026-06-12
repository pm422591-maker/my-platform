<?php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'coins' => 0, 'premium_active' => false]);
    exit;
}

require_once __DIR__ . '/db_connect.php';

try {
    // Перевіряємо наявність колонок (на випадок старої схеми БД)
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
    // НЕ показуємо деталі помилки клієнту
    echo json_encode(['success' => false, 'coins' => 0, 'premium_active' => false]);
}
