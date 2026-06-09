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

// 1. Збираємо всі унікальні ID бейджів для точкового запиту
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
$debugRawBadges = 'No request made'; // Для діагностики

// 2. Запит до точкового API перевірки бейджів (awarded-dates)
if (!empty($allBadgeIds)) {
    // Об'єднуємо через сиру кому, БЕЗ rawurlencode, бо сервери Roblox її вимагають
    $badgeIdsParam = implode(',', $allBadgeIds);
    
    $badgesUrl = sprintf(
        'https://badges.roblox.com/v1/users/%s/badges/awarded-dates?badgeIds=%s',
        rawurlencode($robloxId),
        $badgeIdsParam
    );

    $ch = curl_init($badgesUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie: .ROBLOSECURITY=_CAEaAhADIhsKBGR1aWQSEzY5NTgyNTk1MDc2OTQ1MTU1MzYoAw.cQo8NkBFrFqv1DZ7H992KK1XsNm-fTcXbx_BDJ2bqFVf6IFG6cWER-9LP_X_8fjleVuivyUWvcXuHv5TtWN_DbMhdA4Y33YWoIpzsHk387PKHWut9gl3yWLoAgr8PHDc-wvVp4Xo8voo1eTfbNvLbvDTHV9GnUnWU29QLxJnINpWreCQpMc3Nxa9XE2Y6Z5f_PyzRxhmNVeVywiXnvFNMhsPrN1HehX-Bk9S355knpjCO1M_JQzyOR3IqR2EtmqzZnWee1Qd79mzMSBlqRRs8UXSX2y4KLGicYqIH0zauZe_xZvESdjoi48xSxPsR0XT-mR7j_inx46_Gdf2hHAwRoe9CxcTI6nfO2YgOTMqAaWFS7tJHRaH-ek0_B8Y-VWH3_hX8Q2HkgEBqYTdFLTL-Nye4-xodd2Dn65r80eSEE1riZjisInzLaYmFM2m7NcbGdyoe_I1OLFhUuCbXC951S4o7wj3A4SDzgAxhV-UHbpiRNk3UpiMd4XDNuFnOr605RzM5cMsw3xb-qGnjtzeCgmVQiSCB3Wz2VXViFoa2mAp4qL1xRKXdedDlfsviE09Hri0k0Pmg6FdPVBp-NeNeyjt2JUVX68FaoiNzuhkaEfDrRVBV0X0P19jxw4OWnxbw9hFdk5lMAZOSuHtfmh645CDm4FYAhaVgd3JWmCuorekEr9VSEai1TzEIKLXF3gFb-nN9dXvoU5MSgbJYvHdiuUtgmE2E6PAxidWsoY2VL8Qyx6XPPkycQ9vsc4eMU1cKi7J9Wn_xr0FJt_B75k7wE6bU4rD4bcKm7c3P4YRKd4v-fpA9d5Se3QFVzpzVSMIMMfM9OU3cz3fPZQKQNf88jQvcdkzDJFZb85fyeUiS7KTXppn06s2h-XdkmQHwgVKEO__ogRGzEGb3BV5qfyzqvNIRCtYIEv9KFCrKIPrJthjsQL258IlMiZDZph913AniSmK0kylk54-Y8l6a2Ds8ks_Zn0'
]);
    $raw = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    sleep(2);
    curl_close($ch);

    $debugRawBadges = $raw ? $raw : "cURL Error: $curlError (HTTP $httpCode)";

    if (!$curlError && $httpCode === 200) {
        $parsed = json_decode($raw, true);
        if (isset($parsed['data']) && is_array($parsed['data'])) {
            foreach ($parsed['data'] as $badgeData) {
                if (isset($badgeData['badgeId'])) {
                    // Примусово перетворюємо в string для суворого порівняння ключів
                    $awardedBadgesMap[(string)$badgeData['badgeId']] = true;
                }
            }
        }
    } else {
        $errors[] = [
            'type' => 'SpecificBadgesAwardedDates',
            'status' => $httpCode,
            'message' => "Badge API failed: $curlError",
        ];
    }
}

// 3. Функція перевірки GamePass
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
        'status'  => $httpCode,
    ];
}

$ownedAssets = [];
$seen = [];

// 4. Формуємо фінальний масив
foreach ($library as $game) {
    foreach ($game['items'] as $item) {
        $key = $item['type'] . ':' . $item['id'];
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;

        if ($item['type'] === 'Badge') {
            // Перевіряємо за строковим ключем ID
            if (isset($awardedBadgesMap[(string)$item['id']])) {
                $ownedAssets[] = [
                    'id' => $item['id'],
                    'type' => 'badge',
                    'owned' => true,
                    'game' => $game['game'],
                    'name' => $item['name'],
                ];
            }
        } else {
            // Перевірка геймпасів
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

// 5. Запис в БД та вивід результату з дебаг-полями
try {
    $pdo = get_pdo('utf8mb4');
    $inventoryJson = json_encode($ownedAssets, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare('UPDATE users SET roblox_inventory = ? WHERE id = ?');
    $stmt->execute([$inventoryJson, $userId]);

    echo json_encode([
        'success' => true,
        'owned' => $ownedAssets,
        'errors' => $errors,
        'debug_roblox_response' => $debugRawBadges // Сюди запишеться відповідь від Roblox
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => 'DB Error: ' . $e->getMessage(),
        'owned' => $ownedAssets,
        'errors' => $errors,
        'debug_roblox_response' => $debugRawBadges
    ], JSON_UNESCAPED_UNICODE);
}