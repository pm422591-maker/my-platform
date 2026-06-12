<?php
session_start();
header('Content-Type: text/plain; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    die('Не авторизовано');
}

require_once __DIR__ . '/db_connect.php';

$userId = (int)$_SESSION['user_id'];

// Whitelist дозволених колонок — захист від підстановки довільних імен
$allowedCols = ['avatar_url', 'banner_url', 'background_url'];

$stmt = $pdo->prepare("SELECT avatar_url, banner_url, background_url FROM users WHERE id = ?");
$stmt->execute([$userId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

$updates = [];
$log = [];

foreach ($allowedCols as $col) {
    $path = $row[$col] ?? null;
    if ($path && !file_exists(__DIR__ . '/' . $path)) {
        // Ім'я колонки з whitelist, тому безпечно
        $updates[] = "`$col` = NULL";
        $log[] = "$col: '$path' → NULL (файл не знайдено)";
    } else if ($path) {
        $log[] = "$col: '$path' → OK";
    } else {
        $log[] = "$col: NULL (порожньо)";
    }
}

if ($updates) {
    // $userId передається як параметр, а не в текст запиту
    $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
    $pdo->prepare($sql)->execute([$userId]);
}

echo "=== Результат для user_id=$userId ===\n\n";
echo implode("\n", $log) . "\n\n";
echo $updates ? "Очищено: " . count($updates) . " поле(я)\n" : "Нічого не очищати\n";