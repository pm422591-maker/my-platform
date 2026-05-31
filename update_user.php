<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо зайві помилки
error_reporting(0);
ini_set('display_errors', 0);

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql';   // Виправлено з 127.0.0.1
$db   = 'mywebsite';  // Ім'я твоєї бази
$user = 'root';
$pass = 'root';       // Пароль для Docker

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Перевірка авторизації
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
        exit;
    }

    $userId = $_SESSION['user_id'];

    // Отримуємо дані (JSON)
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Шукаємо нове ім'я в різних ключах (для надійності)
    $newName = $input['new_name'] ?? $input['user'] ?? null;

    // Перевірка на пустоту
    if (!$newName || trim($newName) === '') {
        echo json_encode(['success' => false, 'message' => 'Ім\'я не може бути пустим']);
        exit;
    }

    $newName = trim($newName);

    // --- ОНОВЛЕННЯ ---
    // ВАЖЛИВО: `user` — це зарезервоване слово в SQL, тому беремо його в зворотні лапки ``
    $stmt = $pdo->prepare("UPDATE users SET `user` = ? WHERE id = ?");
    $stmt->execute([$newName, $userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>