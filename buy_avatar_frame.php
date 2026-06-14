<?php
// buy_avatar_frame.php — покупка ободка аватарки за монети
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();
error_reporting(0);
ini_set('display_errors', 0);

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$frame = $input['avatar_frame'] ?? '';

// Каталог ободків: шлях => ціна в монетах
$catalog = [
    'img/1.webm' => 250,
    'img/2.webm' => 250,
];

if (!isset($catalog[$frame])) {
    echo json_encode(['success' => false, 'message' => 'Невідомий ободок.']);
    exit;
}

$cost = $catalog[$frame];

require_once __DIR__ . '/db_connect.php';

try {
    // Колонка coins
    $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('coins', $cols)) {
        try { $pdo->exec("ALTER TABLE users ADD COLUMN coins INT NOT NULL DEFAULT 0"); } catch (Exception $e) {}
    }

    // Таблиця куплених ободків
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_avatar_frames (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            frame VARCHAR(100) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_frame (user_id, frame),
            KEY idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Вже куплено?
    $stmtOwn = $pdo->prepare("SELECT 1 FROM user_avatar_frames WHERE user_id = ? AND frame = ?");
    $stmtOwn->execute([$userId, $frame]);
    if ($stmtOwn->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Ободок вже куплено.', 'already_owned' => true]);
        exit;
    }

    // Баланс
    $stmt = $pdo->prepare("SELECT coins FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'Користувача не знайдено.']);
        exit;
    }
    if ((int)$row['coins'] < $cost) {
        echo json_encode([
            'success' => false,
            'message' => 'Недостатньо монет.',
            'need'    => $cost,
            'have'    => (int)$row['coins']
        ]);
        exit;
    }

    $pdo->beginTransaction();

    // Списуємо монети (з перевіркою балансу в самому UPDATE)
    $stmtBuy = $pdo->prepare(
        "UPDATE users SET coins = coins - :cost WHERE id = :id AND coins >= :cost_check"
    );
    $stmtBuy->execute(['cost' => $cost, 'cost_check' => $cost, 'id' => $userId]);

    if ($stmtBuy->rowCount() === 0) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => 'Недостатньо монет.']);
        exit;
    }

    // Записуємо покупку
    $stmtIns = $pdo->prepare("INSERT INTO user_avatar_frames (user_id, frame) VALUES (?, ?)");
    $stmtIns->execute([$userId, $frame]);

    // Новий баланс
    $stmtBal = $pdo->prepare("SELECT coins FROM users WHERE id = ?");
    $stmtBal->execute([$userId]);
    $newBalance = (int)$stmtBal->fetchColumn();

    $pdo->commit();

    echo json_encode([
        'success'     => true,
        'message'     => 'Ободок придбано!',
        'frame'       => $frame,
        'spent'       => $cost,
        'new_balance' => $newBalance
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("[buy_avatar_frame] " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера.']);
}