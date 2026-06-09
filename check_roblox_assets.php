<?php
declare(strict_types=1);

require_once __DIR__ . '/external_api.php';

header('Content-Type: application/json; charset=utf-8');

$userId  = $_GET['user_id'] ?? '';
$type    = $_GET['type']    ?? '';
$assetId = $_GET['id']      ?? '';

if (!is_string($userId)  || !preg_match('/^\d+$/', $userId)
 || !is_string($assetId) || !preg_match('/^\d+$/', $assetId)
) {
    echo json_encode([
        'success' => false,
        'owned'   => false,
        'message' => 'Invalid or missing Roblox user_id/id',
        'data'    => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$normalizedType = strtolower((string)$type);

// --- BADGE ---
// Roblox Inventory API НЕ підтримує бейджі — використовуємо Badges API
if ($normalizedType === 'badge') {
    $url = sprintf(
        'https://badges.roblox.com/v1/users/%s/badges/awarded-dates?badgeIds=%s',
        rawurlencode($userId),
        rawurlencode($assetId)
    );

    $api = api_http_get_json($url);
    if (!$api['success']) {
        echo json_encode([
            'success' => false,
            'owned'   => false,
            'status'  => $api['status'],
            'message' => 'Roblox Badges API request failed: ' . $api['message'],
            'data'    => [],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // badges API повертає {"data": [...]} — якщо масив не порожній, бейдж є
    $owned = isset($api['data']['data']) && is_array($api['data']['data']) && count($api['data']['data']) > 0;

    echo json_encode([
        'success' => true,
        'owned'   => $owned,
        'type'    => 'Badge',
        'id'      => $assetId,
        'data'    => $owned ? [['id' => $assetId, 'type' => 'Badge', 'owned' => true]] : [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- GAMEPASS ---
if ($normalizedType === 'gamepass' || $normalizedType === 'pass') {
    $url = sprintf(
        'https://inventory.roblox.com/v1/users/%s/items/GamePass/%s/is-owned',
        rawurlencode($userId),
        rawurlencode($assetId)
    );

    $api = api_http_get_json($url);
    if (!$api['success']) {
        echo json_encode([
            'success' => false,
            'owned'   => false,
            'status'  => $api['status'],
            'message' => 'Roblox Inventory API request failed: ' . $api['message'],
            'data'    => [],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $owned = $api['data'] === true;

    echo json_encode([
        'success' => true,
        'owned'   => $owned,
        'type'    => 'GamePass',
        'id'      => $assetId,
        'data'    => $owned ? [['id' => $assetId, 'type' => 'GamePass', 'owned' => true]] : [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Unsupported type ---
echo json_encode([
    'success' => false,
    'owned'   => false,
    'message' => 'Unsupported Roblox asset type: ' . htmlspecialchars($type),
    'data'    => [],
], JSON_UNESCAPED_UNICODE);
exit;