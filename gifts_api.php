<?php
// gifts_api.php — інвентар подарунків користувача + вітрина на профілі
// action=received      → усі подарунки, які отримав користувач (?user_id= необов'язково, інакше свій)
//                        згруповано по gift_icon з кількістю
// action=get_showcase  → які подарунки користувач закріпив на профілі (?user_id=)
// action=set_showcase  → зберегти вибір (масив icons) — лише для себе
session_start();
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'DB']);
    exit;
}

// Таблиця вітрини
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS profile_showcase_gifts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            gift_icon VARCHAR(500) NOT NULL,
            position INT NOT NULL DEFAULT 0,
            KEY idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch (Exception $e) {}

$action  = $_GET['action'] ?? '';
$body    = json_decode(file_get_contents('php://input'), true) ?: [];
if (!$action && isset($body['action'])) $action = $body['action'];

$me = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;

// ── Отримані подарунки (інвентар) ──
if ($action === 'received') {
    $uid = isset($_GET['user_id']) ? (int)$_GET['user_id'] : $me;
    if ($uid <= 0) { echo json_encode(['success' => true, 'gifts' => []]); exit; }
    try {
        // Згруповано по іконці + кількість
        $stmt = $pdo->prepare("
            SELECT gift_icon AS icon, COUNT(*) AS count, MAX(gift_id) AS gift_id
            FROM post_gifts
            WHERE recipient_id = ?
            GROUP BY gift_icon
            ORDER BY count DESC
        ");
        $stmt->execute([$uid]);
        echo json_encode(['success' => true, 'gifts' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (Exception $e) {
        echo json_encode(['success' => true, 'gifts' => []]);
    }
    exit;
}

// ── Вітрина профілю (що показано) ──
if ($action === 'get_showcase') {
    $uid = isset($_GET['user_id']) ? (int)$_GET['user_id'] : $me;
    if ($uid <= 0) { echo json_encode(['success' => true, 'showcase' => []]); exit; }
    try {
        $stmt = $pdo->prepare("SELECT gift_icon AS icon FROM profile_showcase_gifts WHERE user_id = ? ORDER BY position ASC, id ASC");
        $stmt->execute([$uid]);
        echo json_encode(['success' => true, 'showcase' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    } catch (Exception $e) {
        echo json_encode(['success' => true, 'showcase' => []]);
    }
    exit;
}

// ── Зберегти вітрину (лише свою) ──
if ($action === 'set_showcase') {
    if ($me <= 0) { echo json_encode(['success' => false, 'message' => 'Не авторизовано']); exit; }
    $icons = isset($body['icons']) && is_array($body['icons']) ? $body['icons'] : [];
    // максимум 5 у вітрині
    $icons = array_slice($icons, 0, 5);
    try {
        $pdo->prepare("DELETE FROM profile_showcase_gifts WHERE user_id = ?")->execute([$me]);
        $pos = 0;
        $ins = $pdo->prepare("INSERT INTO profile_showcase_gifts (user_id, gift_icon, position) VALUES (?, ?, ?)");
        foreach ($icons as $ic) {
            $ic = trim((string)$ic);
            if ($ic === '') continue;
            // дозволяємо тільки ті, що користувач реально отримував
            $chk = $pdo->prepare("SELECT 1 FROM post_gifts WHERE recipient_id = ? AND gift_icon = ? LIMIT 1");
            $chk->execute([$me, $ic]);
            if ($chk->fetchColumn()) {
                $ins->execute([$me, $ic, $pos++]);
            }
        }
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Помилка збереження']);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Невідома дія']);