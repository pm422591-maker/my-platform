<?php
// save_user_game.php
header("Content-Type: application/json");
session_start();
$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) exit(json_encode(['success' => false]));

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$data = json_decode(file_get_contents('php://input'), true);

$user_id = $_SESSION['user_id'];
$game_name = isset($data['game_name']) ? trim($data['game_name']) : '';
$action    = $data['action'] ?? '';

if ($game_name === '') exit(json_encode(['success' => false, 'message' => 'Порожня назва гри']));

/*
 * 🛡️ Таблиця прихованих ігор стрічки.
 * Сюди потрапляють ігри, які користувач ЗАГЛУШИВ або ВИДАЛИВ зі своєї панелі.
 * get_posts.php виключає пости з group_name = будь-яка з цих ігор.
 * Завдяки цьому заглушення/видалення гри РЕАЛЬНО фільтрує стрічку.
 */
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS hidden_feed_games (
        user_id INT NOT NULL,
        game_name VARCHAR(190) NOT NULL,
        PRIMARY KEY (user_id, game_name)
    ) DEFAULT CHARSET=utf8mb4");
} catch (Exception $e) { /* вже є */ }

$hide = $pdo->prepare("INSERT IGNORE INTO hidden_feed_games (user_id, game_name) VALUES (?, ?)");
$unhide = $pdo->prepare("DELETE FROM hidden_feed_games WHERE user_id = ? AND game_name = ?");

if ($action === 'add') {
    // Додаємо гру в бібліотеку і ПРИБИРАЄМО її зі списку прихованих
    $stmt = $pdo->prepare("INSERT IGNORE INTO user_games (user_id, game_name, is_muted) VALUES (?, ?, 0)");
    $stmt->execute([$user_id, $game_name]);
    $unhide->execute([$user_id, $game_name]);

} elseif ($action === 'remove') {
    // Видаляємо гру з бібліотеки і ХОВАЄМО її пости зі стрічки
    $stmt = $pdo->prepare("DELETE FROM user_games WHERE user_id = ? AND game_name = ?");
    $stmt->execute([$user_id, $game_name]);
    $hide->execute([$user_id, $game_name]);

} elseif ($action === 'toggle_mute') {
    // Перемикаємо стан глушіння
    $stmt = $pdo->prepare("UPDATE user_games SET is_muted = NOT is_muted WHERE user_id = ? AND game_name = ?");
    $stmt->execute([$user_id, $game_name]);

    // Зчитуємо новий стан і синхронізуємо список прихованих ігор
    $check = $pdo->prepare("SELECT is_muted FROM user_games WHERE user_id = ? AND game_name = ? LIMIT 1");
    $check->execute([$user_id, $game_name]);
    $isMuted = (int)$check->fetchColumn();

    if ($isMuted === 1) {
        $hide->execute([$user_id, $game_name]);     // заглушено → ховаємо пости
    } else {
        $unhide->execute([$user_id, $game_name]);   // знято глушіння → повертаємо пости
    }
}

echo json_encode(['success' => true]);