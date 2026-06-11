<?php
// save_user_game.php
header("Content-Type: application/json");
session_start();
$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) exit(json_encode(['success' => false]));

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
$data = json_decode(file_get_contents('php://input'), true);

$user_id = $_SESSION['user_id'];
$game_name = $data['game_name'];

// Додай цей блок у save_user_game.php
if ($data['action'] === 'add') {
    $stmt = $pdo->prepare("INSERT IGNORE INTO user_games (user_id, game_name, is_muted) VALUES (?, ?, 0)");
    $stmt->execute([$user_id, $game_name]);
} elseif ($data['action'] === 'remove') {
    $stmt = $pdo->prepare("DELETE FROM user_games WHERE user_id = ? AND game_name = ?");
    $stmt->execute([$user_id, $game_name]);
} elseif ($data['action'] === 'toggle_mute') { // НОВА ДІЯ
    $stmt = $pdo->prepare("UPDATE user_games SET is_muted = NOT is_muted WHERE user_id = ? AND game_name = ?");
    $stmt->execute([$user_id, $game_name]);
}

echo json_encode(['success' => true]);