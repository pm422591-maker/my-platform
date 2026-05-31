<?php
header('Content-Type: application/json; charset=utf-8');

$user_id = $_GET['user_id'] ?? null;
$type = $_GET['type'] ?? null; // 'Badge' або 'GamePass'
$asset_id = $_GET['id'] ?? null;

if (!$user_id || !$type || !$asset_id) {
    echo json_encode(["success" => false, "message" => "Бракує параметрів"]);
    exit;
}

$url = "";

// Формуємо правильне посилання до API Roblox залежно від типу речі
if ($type === 'Badge') {
    $url = "https://badges.roblox.com/v1/users/{$user_id}/badges/awarded-dates?badgeIds={$asset_id}";
} else if ($type === 'GamePass') {
    $url = "https://inventory.roblox.com/v1/users/{$user_id}/items/GamePass/{$asset_id}";
}

// Робимо запит до Roblox
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

// Просто віддаємо те, що відповів Roblox, назад у твій JavaScript
echo $response;
?>