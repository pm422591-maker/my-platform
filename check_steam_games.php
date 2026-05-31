<?php
header("Access-Control-Allow-Origin: *");
header('Content-Type: application/json; charset=utf-8');

$steamId = $_GET['steam_id'] ?? null;
// ТУТ ВСТАВ СВІЙ STEAM API KEY
$apiKey = "13B1B3C628CCEA4E99410149807EE51E"; 

if (!$steamId) {
    echo json_encode(['success' => false, 'message' => 'Не передано Steam ID']);
    exit;
}

// Формуємо URL до Steam API
// include_appinfo=1 тягне назви ігор, include_played_free_games=1 тягне безкоштовні ігри (як CS2)
$apiUrl = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={$apiKey}&steamid={$steamId}&format=json&include_played_free_games=1";

// Робимо запит
$response = @file_get_contents($apiUrl);

if ($response === FALSE) {
    echo json_encode(['success' => false, 'message' => 'Помилка підключення до Steam API (або профіль закритий)']);
    exit;
}

$data = json_decode($response, true);
$owned_games = array();

// Якщо Steam віддав ігри
if (isset($data['response']['games'])) {
    foreach ($data['response']['games'] as $game) {
        $owned_games[] = array(
            'appid' => $game['appid'],
            'playtime_forever' => $game['playtime_forever']
        );
    }
}

echo json_encode(array(
    'success' => true,
    'owned_games' => $owned_games
));
exit;