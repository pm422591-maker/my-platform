<?php
header('Content-Type: application/json');
session_start();
$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) { echo json_encode([]); exit; }

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmtUsers = $pdo->prepare("SELECT id, username, avatar_url, roblox_id, steam_id, epic_id FROM users WHERE id != ?");
    $stmtUsers->execute([$_SESSION['user_id']]);
    $otherUsers = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);

    $recommendationsData = [];
    // Готуємо запит для ігор заздалегідь
    $stmtGames = $pdo->prepare("SELECT game_name FROM user_games WHERE user_id = ?");

    foreach ($otherUsers as $u) {
        // Збираємо платформи
        $platforms = [];
        if (!empty($u['roblox_id'])) $platforms[] = 'Roblox';
        if (!empty($u['steam_id'])) $platforms[] = 'Steam';
        if (!empty($u['epic_id'])) $platforms[] = 'Epic Games';

        // Збираємо ігри
        $stmtGames->execute([$u['id']]);
        $games = $stmtGames->fetchAll(PDO::FETCH_COLUMN);

        $avatarPath = !empty($u['avatar_url']) ? $u['avatar_url'] : 'img/default_avatar.png';
        if ($avatarPath === 'default_avatar.png') {
            $avatarPath = 'img/default_avatar.png';
        }

        // Пакуємо користувача
        $recommendationsData[] = [
            'id' => $u['id'],
            'name' => $u['username'],
            'avatar' => $avatarPath,
            'platforms' => $platforms, // Додано платформи
            'games' => $games            // Додано ігри
        ];
    }

    echo json_encode($recommendationsData);

} catch (PDOException $e) {
    echo json_encode(['error' => 'Помилка БД: ' . $e->getMessage()]);
}
?>