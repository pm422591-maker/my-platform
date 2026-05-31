<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизований']);
    exit;
}

$host = 'my-mysql'; $db = 'mywebsite'; $user = 'root'; $pass = 'root'; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['games'])) {
        $userId = $_SESSION['user_id'];
        // Перетворюємо масив ігор у JSON-рядок для зберігання в одній колонці
        $gamesJson = json_encode($data['games'], JSON_UNESCAPED_UNICODE);

        // Припускаємо, що у тебе в таблиці 'users' є колонка 'roblox_data' 
        // (якщо ні, створи її типу TEXT або JSON)
        $stmt = $pdo->prepare("UPDATE users SET roblox_data = ? WHERE id = ?");
        $stmt->execute([$gamesJson, $userId]);

        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Дані не отримано']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД']);
}
?>