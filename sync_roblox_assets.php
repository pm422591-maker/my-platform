<?php
session_start();
header('Content-Type: application/json');

// Підключення до БД
try {
    $pdo = new PDO("mysql:host=my-mysql;dbname=mywebsite;charset=utf8", 'root', 'root', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'DB Error']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$robloxId = $data['roblox_id'] ?? null;
$userId = $_SESSION['user_id'] ?? null;

if (!$robloxId || !$userId) {
    echo json_encode(['success' => false, 'message' => 'No IDs provided']);
    exit;
}

// ПОВНИЙ СПИСОК ID
$fullLibrary = [
    'badges' => [
        "2128167319", "2128167321", "2128167324", "2128167328", "2128167329", // Evade
        "2310366779580636", "2491852490394472", "2419608566642291", "554308544894889" // 99 nights
    ],
    'passes' => [
        "1045160877", "1637578813", "1419753648" // Evade passes
    ]
];

$ownedAssets = [];

// 1. ПЕРЕВІРКА БЕЙДЖІВ
$badgeUrl = "https://badges.roblox.com/v1/users/$robloxId/badges/awarded-dates?badgeIds=" . implode(',', $fullLibrary['badges']);
$badgeRes = json_decode(@file_get_contents($badgeUrl), true);

if (isset($badgeRes['data'])) {
    foreach ($badgeRes['data'] as $badge) {
        $ownedAssets[] = [
            'id' => (string)$badge['badgeId'],
            'type' => 'badge',
            'owned' => true
        ];
    }
}

// 2. ПЕРЕВІРКА ГЕЙМПАСІВ
if (isset($fullLibrary['passes'])) {
    foreach ($fullLibrary['passes'] as $passId) {
        $passUrl = "https://inventory.roblox.com/v1/users/$robloxId/items/GamePass/$passId";
        $passRes = json_decode(@file_get_contents($passUrl), true);
        if (!empty($passRes['data'])) {
            $ownedAssets[] = [
                'id' => (string)$passId,
                'type' => 'pass',
                'owned' => true
            ];
        }
    }
}

// 3. ЗБЕРЕЖЕННЯ
$inventoryJson = json_encode($ownedAssets);
$stmt = $pdo->prepare("UPDATE users SET roblox_inventory = ? WHERE id = ?");
$stmt->execute([$inventoryJson, $userId]);

echo json_encode(['success' => true, 'owned' => $ownedAssets]);