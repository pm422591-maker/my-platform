<?php
// УТИЛІТА: очищає в БД посилання на файли яких немає на диску
// Відкрий у браузері один раз, потім видали цей файл!
error_reporting(0);
ini_set('display_errors', 0);
session_start();

if (!isset($_SESSION['user_id'])) {
    die('Не авторизовано');
}

$pdo = new PDO('mysql:host=my-mysql;dbname=mywebsite;charset=utf8', 'root', 'root', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

$userId = $_SESSION['user_id'];
$stmt = $pdo->prepare("SELECT avatar_url, banner_url, background_url FROM users WHERE id = ?");
$stmt->execute([$userId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

$updates = [];
$log = [];

foreach (['avatar_url', 'banner_url', 'background_url'] as $col) {
    $path = $row[$col] ?? null;
    if ($path && !file_exists(__DIR__ . '/' . $path)) {
        $updates[] = "`$col` = NULL";
        $log[] = "$col: '$path' → NULL (файл не знайдено)";
    } else if ($path) {
        $log[] = "$col: '$path' → OK";
    } else {
        $log[] = "$col: NULL (порожньо)";
    }
}

if ($updates) {
    $pdo->exec("UPDATE users SET " . implode(', ', $updates) . " WHERE id = $userId");
}

header('Content-Type: text/plain; charset=utf-8');
echo "=== Результат для user_id=$userId ===\n\n";
echo implode("\n", $log) . "\n\n";
echo $updates ? "✅ Очищено: " . count($updates) . " поле(я)\n" : "✅ Нічого не очищати\n";
?>