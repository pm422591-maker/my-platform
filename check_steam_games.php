<?php
declare(strict_types=1);

require_once __DIR__ . '/external_api.php';

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$steamId = $_GET['steam_id'] ?? '';
$apiKey = getenv('STEAM_API_KEY') ?: '13B1B3C628CCEA4E99410149807EE51E';

if (!is_string($steamId) || !preg_match('/^\d{16,25}$/', $steamId)) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid or missing Steam ID',
        'owned_games' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($apiKey === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Steam API key is missing',
        'owned_games' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$query = http_build_query([
    'key' => $apiKey,
    'steamid' => $steamId,
    'format' => 'json',
    'include_played_free_games' => 1,
    'include_appinfo' => 1,
]);
$apiUrl = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?' . $query;

$api = api_http_get_json($apiUrl);

if (!$api['success']) {
    echo json_encode([
        'success' => false,
        'message' => 'Steam API request failed: ' . $api['message'],
        'status' => $api['status'],
        'owned_games' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$response = is_array($api['data']) ? ($api['data']['response'] ?? null) : null;
if (!is_array($response)) {
    echo json_encode([
        'success' => false,
        'message' => 'Steam API returned an unexpected response',
        'owned_games' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$games = $response['games'] ?? [];
if (!is_array($games)) {
    $games = [];
}

$ownedGames = [];
foreach ($games as $game) {
    if (!is_array($game) || !isset($game['appid'])) {
        continue;
    }

    $ownedGames[] = [
        'appid' => (int)$game['appid'],
        'name' => isset($game['name']) ? (string)$game['name'] : '',
        'playtime_forever' => isset($game['playtime_forever']) ? (int)$game['playtime_forever'] : 0,
    ];
}

$isPrivate = !array_key_exists('games', $response);

echo json_encode([
    'success' => true,
    'private' => $isPrivate,
    'message' => $isPrivate
        ? 'Steam did not return games. The profile or Game details privacy is likely private.'
        : '',
    'game_count' => isset($response['game_count']) ? (int)$response['game_count'] : count($ownedGames),
    'owned_games' => $ownedGames,
], JSON_UNESCAPED_UNICODE);
exit;
