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

$errors = [];
$awardedBadgesMap = [];

// ==========================================
// НОВИЙ МЕТОД ОБХОДУ БЛОКУВАННЯ ROBLOX
// Скануємо загальний відкритий список бейджів 
// (беремо до 500 останніх отриманих бейджів)
// ==========================================
$cursor = '';
$pagesFetched = 0;
$maxPages = 5; // 5 сторінок по 100 бейджів = глибина пошуку 500 штук

while ($pagesFetched < $maxPages) {
    $badgesUrl = sprintf('https://badges.roblox.com/v1/users/%s/badges?limit=100&sortOrder=Desc', rawurlencode($robloxId));
    if ($cursor !== '') {
        $badgesUrl .= '&cursor=' . rawurlencode($cursor);
    }

    $ch = curl_init($badgesUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    ]);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $raw) {
        $parsed = json_decode($raw, true);
        if (isset($parsed['data']) && is_array($parsed['data'])) {
            foreach ($parsed['data'] as $badgeData) {
                if (isset($badgeData['id'])) {
                    $awardedBadgesMap[(string)$badgeData['id']] = true;
                }
            }
        }
        
        // Перевіряємо, чи є наступна сторінка бейджів
        if (!empty($parsed['nextPageCursor'])) {
            $cursor = $parsed['nextPageCursor'];
            $pagesFetched++;
        } else {
            break; // Більше бейджів на акаунті немає
        }
    } else {
        $errors[] = [
            'type' => 'BadgesPublicScan',
            'status' => $httpCode,
            'message' => 'Failed to fetch badges. Account inventory might be private. HTTP ' . $httpCode
        ];
        break; // Якщо інвентар закритий (HTTP 400/403/401), зупиняємо пошук
    }
}

// Функція для поштучної перевірки GamePass
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
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    ]);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        return ['success' => true, 'owned' => json_decode($raw, true) === true];
    }
    return ['success' => false, 'owned' => false, 'status' => $httpCode];
}

$ownedAssets = [];
$seen = [];

// Збираємо фінальний результат
foreach ($library as $game) {
    foreach ($game['items'] as $item) {
        $key = $item['type'] . ':' . $item['id'];
        if (isset($seen[$key])) continue;
        $seen[$key] = true;

        if ($item['type'] === 'Badge') {
            // Перевіряємо чи знайшли ми цей бейдж у завантаженому публічному списку
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
            // Геймпаси перевіряємо як і раніше
            $result = roblox_gamepass_is_owned($robloxId, $item['id']);
            if ($result['success'] && $result['owned']) {
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

// Оновлюємо БД
try {
    $pdo = get_pdo('utf8mb4');
    $inventoryJson = json_encode($ownedAssets, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare('UPDATE users SET roblox_inventory = ? WHERE id = ?');
    $stmt->execute([$inventoryJson, $userId]);

    echo json_encode(['success' => true, 'owned' => $ownedAssets, 'errors' => $errors], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'message' => 'DB Error: ' . $e->getMessage(), 'owned' => $ownedAssets, 'errors' => $errors], JSON_UNESCAPED_UNICODE);
}