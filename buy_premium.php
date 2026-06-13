<?php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$plan  = $input['plan'] ?? null; // 'month' или 'year'

$plans = [
    'month' => ['coins' => 1000,  'days' => 30,  'label' => '1 месяц'],
    'year'  => ['coins' => 20000, 'days' => 365, 'label' => '1 год'],
];

if (!isset($plans[$plan])) {
    echo json_encode(['success' => false, 'message' => 'Неверный план подписки.']);
    exit;
}

$cost = $plans[$plan]['coins'];
$days = $plans[$plan]['days'];

require_once __DIR__ . '/db_connect.php';

try {
    // Переконуємось, що потрібні колонки існують (помилки ALTER не валять покупку)
    $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('coins', $cols)) {
        try { $pdo->exec("ALTER TABLE users ADD COLUMN coins INT NOT NULL DEFAULT 0"); } catch (Exception $e) { error_log("[buy_premium] alter coins: " . $e->getMessage()); }
    }
    if (!in_array('premium_until', $cols)) {
        try { $pdo->exec("ALTER TABLE users ADD COLUMN premium_until DATETIME NULL DEFAULT NULL"); } catch (Exception $e) { error_log("[buy_premium] alter premium_until: " . $e->getMessage()); }
    }

    $stmt = $pdo->prepare("SELECT coins, premium_until FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Пользователь не найден.']);
        exit;
    }

    if ((int)$row['coins'] < $cost) {
        echo json_encode([
            'success' => false,
            'message' => 'Недостаточно монет.',
            'need'    => $cost,
            'have'    => (int)$row['coins']
        ]);
        exit;
    }

    // Продовжуємо преміум, якщо ще активний.
    // Захист від невалідних дат у БД ('0000-00-00 00:00:00', порожні рядки тощо).
    $now = new DateTime();
    $currentUntil = null;
    $rawUntil = $row['premium_until'] ?? null;
    if ($rawUntil && strpos($rawUntil, '0000-00-00') === false) {
        try {
            $dt = new DateTime($rawUntil);
            $currentUntil = $dt;
        } catch (Exception $e) {
            $currentUntil = null; // невалідну дату ігноруємо
        }
    }
    $base = ($currentUntil && $currentUntil > $now) ? $currentUntil : $now;
    $newUntil = (clone $base)->modify("+{$days} days");

    $pdo->beginTransaction();

    $stmtBuy = $pdo->prepare(
        "UPDATE users SET coins = coins - :cost, premium_until = :until WHERE id = :id AND coins >= :cost_check"
    );
    $stmtBuy->execute([
        'cost'       => $cost,
        'cost_check' => $cost,
        'until'      => $newUntil->format('Y-m-d H:i:s'),
        'id'         => $userId
    ]);

    if ($stmtBuy->rowCount() === 0) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => 'Транзакция не прошла (недостаточно монет).']);
        exit;
    }

    $stmtFetch = $pdo->prepare("SELECT coins, premium_until FROM users WHERE id = ?");
    $stmtFetch->execute([$userId]);
    $updated = $stmtFetch->fetch();

    $pdo->commit();

    echo json_encode([
        'success'       => true,
        'message'       => "Premium активирован на {$plans[$plan]['label']}!",
        'plan'          => $plan,
        'spent'         => $cost,
        'new_balance'   => (int)$updated['coins'],
        'premium_until' => $updated['premium_until']
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("[buy_premium] error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера.']);
}