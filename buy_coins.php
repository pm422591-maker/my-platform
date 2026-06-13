<?php
// buy_coins.php — магазин монет. Поки що монети нараховуються БЕЗ оплати грошима.
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано.']);
    exit;
}

$input  = json_decode(file_get_contents('php://input'), true);
$amount = isset($input['amount']) ? (int)$input['amount'] : 0;

// Дозволені пакети монет (від 100 до 10000)
$allowedPacks = [100, 250, 500, 1000, 2500, 5000, 10000];

if (!in_array($amount, $allowedPacks, true)) {
    echo json_encode(['success' => false, 'message' => 'Невірний пакет монет.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

try {
    // Переконуємось, що колонка coins існує
    $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('coins', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN coins INT NOT NULL DEFAULT 0");
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("UPDATE users SET coins = coins + :amount WHERE id = :id");
    $stmt->execute(['amount' => $amount, 'id' => $userId]);

    $stmtBalance = $pdo->prepare("SELECT coins FROM users WHERE id = ?");
    $stmtBalance->execute([$userId]);
    $row = $stmtBalance->fetch();

    $pdo->commit();

    echo json_encode([
        'success'     => true,
        'message'     => "Зараховано {$amount} монет!",
        'added'       => $amount,
        'new_balance' => (int)$row['coins']
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("[buy_coins] error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера.']);
}
