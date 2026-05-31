<?php
session_start();
header('Content-Type: application/json');

// Подключение к БД (замени на свои данные)
require_once 'db_connect.php'; 

// Проверяем, авторизован ли пользователь на самом сайте
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$userId = $_SESSION['user_id'];

// Достаем данные интеграций из базы
$stmt = $conn->prepare("SELECT roblox_id, steam_id, epic_id FROM users WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if ($user) {
    // Отправляем JSON, где true - если ID есть, и false - если пусто
    echo json_encode([
        'success' => true,
        'roblox_linked' => !empty($user['roblox_id']),
        'steam_linked' => !empty($user['steam_id']),
        'epic_linked' => !empty($user['epic_id'])
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'User not found']);
}
?>