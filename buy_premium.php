<?php
// buy_premium.php — Покупка Premium подписки за монеты
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');

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

try {
    $pdo = new PDO(
        "mysql:host=my-mysql;dbname=mywebsite;charset=utf8mb4",
        'root', 'root',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    // Убеждаемся, что нужные колонки существуют
    $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('coins', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN coins INT NOT NULL DEFAULT 0");
    }
    if (!in_array('premium_until', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN premium_until DATETIME NULL DEFAULT NULL");
    }

    // Читаем текущий баланс и статус премиума
    $stmt = $pdo->prepare("SELECT coins, premium_until FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Пользователь не найден.']);
        exit;
    }

    if ((int)$row['coins'] < $cost) {
        echo json_encode([
            'success'  => false,
            'message'  => 'Недостаточно монет.',
            'need'     => $cost,
            'have'     => (int)$row['coins']
        ]);
        exit;
    }

    // Вычисляем новую дату окончания (продлеваем, если уже есть активный премиум)
    $now = new DateTime();
    $currentUntil = $row['premium_until'] ? new DateTime($row['premium_until']) : null;
    $base = ($currentUntil && $currentUntil > $now) ? $currentUntil : $now;
    $newUntil = (clone $base)->modify("+{$days} days");

    $pdo->beginTransaction();

    $stmtBuy = $pdo->prepare(
        "UPDATE users SET coins = coins - :cost, premium_until = :until WHERE id = :id AND coins >= :cost"
    );
    $stmtBuy->execute([
        'cost'  => $cost,
        'until' => $newUntil->format('Y-m-d H:i:s'),
        'id'    => $userId
    ]);

    if ($stmtBuy->rowCount() === 0) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => 'Транзакция не прошла (недостаточно монет).']);
        exit;
    }

    // Получаем обновлённые данные
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
    echo json_encode(['success' => false, 'message' => 'Ошибка БД: ' . $e->getMessage()]);
}
