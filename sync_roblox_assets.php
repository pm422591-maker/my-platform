<?php
declare(strict_types=1);

// db підключення напряму
function get_pdo(string $charset = 'utf8mb4'): PDO {
    return new PDO(
        "mysql:host=my-mysql;dbname=mywebsite;charset=$charset",
        'root', 'root',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
}

session_start();
header('Content-Type: application/json; charset=utf-8');

$data = json_decode(file_get_contents('php://input'), true);
$robloxId = is_array($data) ? (string)($data['roblox_id'] ?? '') : '';
$userId = $_SESSION['user_id'] ?? null;

if ($robloxId === '' || !preg_match('/^\d+$/', $robloxId) || !$userId) {
    echo json_encode([
        'success' => false,
        'message' => 'Missing Roblox ID or active session',
        'owned' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$library = [
    [
        'game' => 'Evade',
        'items' => [
            ['id' => '2128167319', 'type' => 'Badge', 'name' => '25 lvl'],
            ['id' => '2128167321', 'type' => 'Badge', 'name' => '50 lvl'],
            ['id' => '2128167324', 'type' => 'Badge', 'name' => '75 lvl'],
            ['id' => '2128167328', 'type' => 'Badge', 'name' => '100 lvl'],
            ['id' => '2128167329', 'type' => 'Badge', 'name' => '125 lvl'],
            ['id' => '1045160877', 'type' => 'GamePass', 'name' => 'Crystalline Set'],
            ['id' => '1637578813', 'type' => 'GamePass', 'name' => 'Dog Set'],
            ['id' => '1419753648', 'type' => 'GamePass', 'name' => 'Retro Cosmetics Set'],
        ],
    ],
    [
        'game' => '99 nights in the forest',
        'items' => [
            ['id' => '2310366779580636', 'type' => 'Badge', 'name' => '10 days'],
            ['id' => '2491852490394472', 'type' => 'Badge', 'name' => '20 days'],
            ['id' => '2419608566642291', 'type' => 'Badge', 'name' => '30 days'],
            ['id' => '554308544894889', 'type' => 'Badge', 'name' => '40 days'],
            ['id' => '3412064596604231', 'type' => 'Badge', 'name' => '50 days'],
        ],
    ],
];

function roblox_item_is_owned(string $robloxId, string $itemType, string $itemId): array
{
    // Для бейджів і геймпасів — різні API endpoints
    if ($itemType === 'Badge') {
        $url = sprintf(
            'https://badges.roblox.com/v1/users/%s/badges/awarded-dates?badgeIds=%s',
            rawurlencode($robloxId),
            rawurlencode($itemId)
        );
    } else {
        // GamePass
        $url = sprintf(
            'https://inventory.roblox.com/v1/users/%s/items/GamePass/%s/is-owned',
            rawurlencode($robloxId),
            rawurlencode($itemId)
        );
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError || $httpCode !== 200) {
        return [
            'success' => false,
            'owned'   => false,
            'message' => "HTTP $httpCode cURL: $curlError",
            'status'  => $httpCode,
        ];
    }

    $parsed = json_decode($raw, true);

    if ($itemType === 'Badge') {
        // badges API повертає {"data": [...]} — якщо масив не порожній, бейдж є
        $owned = isset($parsed['data']) && count($parsed['data']) > 0;
    } else {
        // GamePass is-owned повертає просто true або false
        $owned = $parsed === true;
    }

    return [
        'success' => true,
        'owned'   => $owned,
        'message' => '',
        'status'  => $httpCode,
    ];
}

$ownedAssets = [];
$errors = [];
$checked = 0;
$failed = 0;
$seen = [];

foreach ($library as $game) {
    foreach ($game['items'] as $item) {
        $key = $item['type'] . ':' . $item['id'];
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $checked++;

        $result = roblox_item_is_owned($robloxId, $item['type'], $item['id']);
        if (!$result['success']) {
            $failed++;
            $errors[] = [
                'id' => $item['id'],
                'type' => $item['type'],
                'status' => $result['status'],
                'message' => $result['message'],
            ];
            continue;
        }

        if ($result['owned']) {
            $ownedAssets[] = [
                'id' => $item['id'],
                'type' => $item['type'] === 'GamePass' ? 'pass' : 'badge',
                'owned' => true,
                'game' => $game['game'],
                'name' => $item['name'],
            ];
        }
    }
}

if ($checked > 0 && $failed === $checked) {
    echo json_encode([
        'success' => false,
        'message' => 'Roblox Inventory API failed for every checked item. Existing inventory was not overwritten.',
        'owned' => [],
        'errors' => $errors,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = get_pdo('utf8mb4');
    $inventoryJson = json_encode($ownedAssets, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare('UPDATE users SET roblox_inventory = ? WHERE id = ?');
    $stmt->execute([$inventoryJson, $userId]);

    echo json_encode([
        'success' => true,
        'owned' => $ownedAssets,
        'errors' => $errors,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => 'DB Error: ' . $e->getMessage(),
        'owned' => $ownedAssets,
        'errors' => $errors,
    ], JSON_UNESCAPED_UNICODE);
}
