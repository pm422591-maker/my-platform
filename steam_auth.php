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

// Твої налаштування БД
$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // ЛОГ ПЕРЕВІРКИ: запишемо у файл, що прийшло від Steam
    file_put_contents('log_steam.txt', print_r($_GET, true), FILE_APPEND);

    // Steam передає дані через GET, головний параметр - openid_claimed_id
    // Він виглядає так: https://steamcommunity.com/openid/id/76561198xxxxxxxxx
    if (isset($_GET['openid_claimed_id'])) {
        
        // Витягуємо лише цифри (Steam64 ID) з цього посилання
        preg_match("/^https?:\/\/steamcommunity\.com\/openid\/id\/(7[0-9]{15,25}+)$/", $_GET['openid_claimed_id'], $matches);
        
        if (!empty($matches[1])) {
            $steamId = $matches[1];
            $userId = $_SESSION['user_id'];

            // ЗБЕРІГАЄМО В БД (Колонка steam_id)
            $stmt = $pdo->prepare("UPDATE users SET steam_id = ? WHERE id = ?");
            $stmt->execute([$steamId, $userId]);

            echo json_encode([
                'success' => true, 
                'steam_id' => $steamId,
                'affected' => $stmt->rowCount(),
                'message' => 'Steam ID успішно збережено в БД!'
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Не вдалося розпізнати Steam ID з посилання.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Дані від Steam відсутні.']);
    }

} catch (Exception $e) {
    file_put_contents('log_steam.txt', "ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>