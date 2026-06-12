<?php
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Пользователь не авторизован.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$reward_coins = 100;

try {
    // 1. Переконуємось, що колонки існують
    $existingCols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('coins', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN coins INT NOT NULL DEFAULT 0");
    }
    if (!in_array('tutorial_coins_rewarded', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN tutorial_coins_rewarded TINYINT(1) NOT NULL DEFAULT 0");
    }

    // 2. Перевіряємо, чи не була вже видана нагорода
    $stmtCheck = $pdo->prepare("SELECT tutorial_coins_rewarded, coins FROM users WHERE id = ?");
    $stmtCheck->execute([$userId]);
    $row = $stmtCheck->fetch();

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Пользователь не найден в базе.']);
        exit;
    }

    if ($row['tutorial_coins_rewarded'] == 1) {
        echo json_encode([
            'success'          => true,
            'already_rewarded' => true,
            'message'          => 'Награда уже была получена ранее.',
            'added'            => 0,
            'new_balance'      => (int)$row['coins']
        ]);
        exit;
    }

    // 3. Атомарно нараховуємо монети і ставимо прапор
    $pdo->beginTransaction();

    $stmtUpdate = $pdo->prepare(
        "UPDATE users SET coins = coins + :reward, tutorial_coins_rewarded = 1 WHERE id = :id"
    );
    $stmtUpdate->execute(['reward' => $reward_coins, 'id' => $userId]);

    $stmtBalance = $pdo->prepare("SELECT coins FROM users WHERE id = ?");
    $stmtBalance->execute([$userId]);
    $newRow = $stmtBalance->fetch();

    $pdo->commit();

    echo json_encode([
        'success'          => true,
        'already_rewarded' => false,
        'message'          => 'Монеты успешно зачислены!',
        'added'            => $reward_coins,
        'new_balance'      => (int)$newRow['coins']
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("[add_tutorial_coins] error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера.']);
}