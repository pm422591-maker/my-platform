<?php
// Встановлюємо заголовок, щоб браузер розумів, що це JSON
header('Content-Type: application/json; charset=utf-8');

// 🔴 ВАЖЛИВО: Встав сюди свій Steam Web API Key
// Його можна отримати тут: https://steamcommunity.com/dev/apikey
$steamApiKey = "ТВІЙ_STEAM_API_KEY_ТУТ"; 

// Отримуємо steam_id з GET-запиту
$steamId = isset($_GET['steam_id']) ? $_GET['steam_id'] : null;

// Перевіряємо, чи передали нам взагалі Steam ID
if (!$steamId || !is_numeric($steamId)) {
    echo json_encode(["success" => false, "message" => "Невірний або відсутній Steam ID"]);
    exit;
}

// Формуємо URL для запиту до Steam API
// Параметр include_played_free_games=1 ВАЖЛИВИЙ, щоб безкоштовні ігри (як CS:GO/CS2) теж поверталися!
$apiUrl = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={$steamApiKey}&steamid={$steamId}&format=json&include_played_free_games=1";

// Використовуємо cURL для відправки запиту до Steam
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Чекаємо максимум 10 секунд
// curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Розкоментуй, якщо на локалці (OpenServer/XAMPP) буде помилка SSL

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Якщо Steam API не відповідає або повернув помилку
if ($httpCode !== 200 || !$response) {
    echo json_encode(["success" => false, "message" => "Помилка зв'язку зі Steam API"]);
    exit;
}

// Декодуємо JSON від Steam
$data = json_decode($response, true);

// Перевіряємо, чи формат відповіді правильний
if (!isset($data['response'])) {
    echo json_encode(["success" => false, "message" => "Некоректна відповідь від Steam API"]);
    exit;
}

$ownedGames = [];

// Стало так (тепер віддаємо і ID, і час у хвилинах):
if (isset($data['response']['games']) && is_array($data['response']['games'])) {
    foreach ($data['response']['games'] as $game) {
        $ownedGames[] = [
            "appid" => $game['appid'],
            "playtime" => isset($game['playtime_forever']) ? $game['playtime_forever'] : 0
        ];
    }
}

// Повертаємо твоїм JS-скриптам красивий масив з ID ігор
echo json_encode([
    "success" => true,
    "owned_games" => $ownedGames
]);
?>