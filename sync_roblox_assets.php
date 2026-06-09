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

// 1. Збираємо всі унікальні ID бейджів для ОДНОГО масового запиту
$allBadgeIds = [];
foreach ($library as $game) {
    foreach ($game['items'] as $item) {
        if ($item['type'] === 'Badge') {
            $allBadgeIds[] = $item['id'];
        }
    }
}
$allBadgeIds = array_unique($allBadgeIds);

$awardedBadgesMap = [];
$errors = [];

// 2. Виконуємо один масовий запит до API бейджів з імітацією браузера
if (!empty($allBadgeIds)) {
    $badgesUrl = sprintf(
        'https://badges.roblox.com/v1/users/%s/badges/awarded-dates?badgeIds=%s',
        rawurlencode($robloxId),
        implode(',', $allBadgeIds)
    );

    $ch = curl_init($badgesUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if (!$curlError && $httpCode === 200) {
        $parsed = json_decode($raw, true);
        if (isset($parsed['data']) && is_array($parsed['data'])) {
            foreach ($parsed['data'] as $badgeData) {
                if (isset($badgeData['badgeId'])) {
                    $awardedBadgesMap[(string)$badgeData['badgeId']] = true;
                }
            }
        }
    } else {
        $errors[] = [
            'type' => 'AllBadgesBulk',
            'status' => $httpCode,
            'message' => "Bulk Badge API failed: $curlError",
        ];
    }
}

// 3. Функція для поштучної перевірки GamePass (теж додаємо User-Agent)
function roblox_gamepass_is_owned(string $robloxId, string $gamepassId): array {
    $url = sprintf(
        'https://inventory.roblox.com/v1/users/%s/items/GamePass/%s/is-owned',
        rawurlencode($robloxId),
        rawurlencode($gamepassId)
    );

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]);
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

    return [
        'success' => true,
        'owned'   => json_decode($raw, true) === true,
        'message' => '',
        'status'  => $httpCode,
    ];
}

$ownedAssets = [];
$seen = [];

// 4. Формуємо фінальний масив на основі отриманих даних
foreach ($library as $game) {
    foreach ($game['items'] as $item) {
        $key = $item['type'] . ':' . $item['id'];
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;

        if ($item['type'] === 'Badge') {
            // Перевіряємо, чи є ID бейджа в нашій мапі успішно знайдених
            if (isset($awardedBadgesMap[$item['id']])) {
                $ownedAssets[] = [
                    'id' => $item['id'],
                    'type' => 'badge',
                    'owned' => true,
                    'game' => $game['game'],
                    'name' => $item['name'],
                ];
            }
        } else {
            // Перевірка GamePass
            $result = roblox_gamepass_is_owned($robloxId, $item['id']);
            if (!$result['success']) {
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
                    'type' => 'pass',
                    'owned' => true,
                    'game' => $game['game'],
                    'name' => $item['name'],
                ];
            }
        }
    }
}

// 5. Запис результату в базу даних
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