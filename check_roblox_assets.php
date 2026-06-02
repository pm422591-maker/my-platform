<?php
declare(strict_types=1);

require_once __DIR__ . '/external_api.php';

header('Content-Type: application/json; charset=utf-8');

$userId = $_GET['user_id'] ?? '';
$type = $_GET['type'] ?? '';
$assetId = $_GET['id'] ?? '';

if (!is_string($userId) || !preg_match('/^\d+$/', $userId)
    || !is_string($assetId) || !preg_match('/^\d+$/', $assetId)
) {
    echo json_encode([
        'success' => false,
        'owned' => false,
        'message' => 'Invalid or missing Roblox user_id/id',
        'data' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$normalizedType = strtolower((string)$type);
$itemType = null;

if ($normalizedType === 'badge') {
    $itemType = 'Badge';
} elseif ($normalizedType === 'gamepass' || $normalizedType === 'pass') {
    $itemType = 'GamePass';
}

if ($itemType === null) {
    echo json_encode([
        'success' => false,
        'owned' => false,
        'message' => 'Unsupported Roblox asset type',
        'data' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$url = sprintf(
    'https://inventory.roblox.com/v1/users/%s/items/%s/%s/is-owned',
    rawurlencode($userId),
    rawurlencode($itemType),
    rawurlencode($assetId)
);

$api = api_http_get_json($url);
if (!$api['success']) {
    echo json_encode([
        'success' => false,
        'owned' => false,
        'status' => $api['status'],
        'message' => 'Roblox Inventory API request failed: ' . $api['message'],
        'data' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$owned = $api['data'] === true;

echo json_encode([
    'success' => true,
    'owned' => $owned,
    'type' => $itemType,
    'id' => $assetId,
    'data' => $owned ? [[
        'id' => $assetId,
        'type' => $itemType,
        'owned' => true,
    ]] : [],
], JSON_UNESCAPED_UNICODE);
exit;
