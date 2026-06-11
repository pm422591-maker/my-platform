<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Тимчасово увімкнемо помилки для діагностики
ini_set('display_errors', 1);
error_reporting(E_ALL);

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Сесія не знайдена']);
    exit;
}

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $input = json_decode(file_get_contents('php://input'), true);
    
    // ЛОГ ПЕРЕВІРКИ: запишемо у файл, що прийшло від JS
    file_put_contents('log.txt', print_r($input, true), FILE_APPEND);

    if (isset($input['roblox_id'])) {
        $userId = $_SESSION['user_id'];
        $robloxId = $input['roblox_id'];

        // ОНОВЛЕННЯ: важливо, щоб назва колонки співпадала з БД (roblox_id)
        $stmt = $pdo->prepare("UPDATE users SET roblox_id = ? WHERE id = ?");
        $result = $stmt->execute([$robloxId, $userId]);

        echo json_encode(['success' => true, 'affected' => $stmt->rowCount()]);
    } else {
        echo json_encode(['success' => false, 'message' => 'roblox_id відсутній у запиті']);
    }

} catch (Exception $e) {
    file_put_contents('log.txt', "ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>