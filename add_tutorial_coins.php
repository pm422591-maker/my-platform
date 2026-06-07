<?php
// add_tutorial_coins.php — Зачисление монет за прохождение туториала
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$isSecure = true;
session_set_cookie_params([
    'lifetime' => 86400,
    'path' => '/',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'None'
]);
session_start();

// Проверяем авторизацию (используем user_id, как и во всех остальных файлах)
$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Пользователь не авторизован.']);
    exit;
}

$reward_coins = 100;

try {
    $pdo = new PDO(
        "mysql:host=my-mysql;dbname=mywebsite;charset=utf8mb4",
        'root', 'root',
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );

    // 1. Убеждаемся, что колонки coins и tutorial_coins_rewarded существуют
    $existingCols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('coins', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN coins INT NOT NULL DEFAULT 0");
    }
    if (!in_array('tutorial_coins_rewarded', $existingCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN tutorial_coins_rewarded TINYINT(1) NOT NULL DEFAULT 0");
    }

    // 2. Проверяем, не была ли уже выдана награда этому пользователю
    $stmtCheck = $pdo->prepare("SELECT tutorial_coins_rewarded, coins FROM users WHERE id = ?");
    $stmtCheck->execute([$userId]);
    $row = $stmtCheck->fetch();

    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Пользователь не найден в базе.']);
        exit;
    }

    if ($row['tutorial_coins_rewarded'] == 1) {
        // Награда уже была получена — просто возвращаем текущий баланс
        echo json_encode([
            'success' => true,
            'already_rewarded' => true,
            'message' => 'Награда уже была получена ранее.',
            'added' => 0,
            'new_balance' => (int)$row['coins']
        ]);
        exit;
    }

    // 3. Атомарно начисляем монеты и помечаем флаг (транзакция)
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
        'success' => true,
        'already_rewarded' => false,
        'message' => 'Монеты успешно зачислены!',
        'added' => $reward_coins,
        'new_balance' => (int)$newRow['coins']
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("[add_tutorial_coins] error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Ошибка БД: ' . $e->getMessage()]);
}
