<?php
header('Content-Type: application/json');
session_start();
$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) { echo json_encode(['platforms' => [], 'games' => []]); exit; }

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $my_id = $_SESSION['user_id'];

    // 1. Збираємо твої ПЛАТФОРМИ
    $stmt = $pdo->prepare("SELECT roblox_id, steam_id, epic_id FROM users WHERE id = ?");
    $stmt->execute([$my_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $my_platforms = [];
    if (!empty($row['roblox_id'])) $my_platforms[] = 'Roblox';
    if (!empty($row['steam_id'])) $my_platforms[] = 'Steam';
    if (!empty($row['epic_id'])) $my_platforms[] = 'Epic Games';

    // 2. Збираємо твої ІГРИ
    $stmtGames = $pdo->prepare("SELECT game_name FROM user_games WHERE user_id = ?");
    $stmtGames->execute([$my_id]);
    $my_games = $stmtGames->fetchAll(PDO::FETCH_COLUMN);

    // Віддаємо все разом!
    echo json_encode([
        'platforms' => $my_platforms, 
        'games' => $my_games
    ]);

} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>