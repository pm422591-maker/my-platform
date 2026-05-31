<?php
session_start();
header('Content-Type: application/json');
$host = 'my-mysql';
// Ім'я бази, яку ми вказали в environment (рядок 20)
$db   = 'mywebsite';
// Пароль root, який ми вказали (рядок 19)
$user = 'root';
$pass = 'root';       

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    $userId = $_SESSION['user_id'] ?? null;
    $input = json_decode(file_get_contents('php://input'), true);
    $newName = $input['username'] ?? null;

    if ($userId && $newName) {
        // Оновлюємо колонку username (номер 2 у твоїй таблиці)
        $stmt = $pdo->prepare("UPDATE users SET username = ? WHERE id = ?");
        $stmt->execute([$newName, $userId]);
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Немає даних або сесії']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>