<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо вивід помилок у текст
error_reporting(0);
ini_set('display_errors', 0);

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql';  // ВИПРАВЛЕНО: було 'db', стало 'my-mysql'
$db   = 'mywebsite'; // Перевір назву бази
$user = 'root';
$pass = 'root';      // Пароль root

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    $userId = $_SESSION['user_id'] ?? null;
    
    if (!$userId) {
        echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (isset($input['day'], $input['month'], $input['year'])) {
        
        $d = (int)$input['day'];
        $m = (int)$input['month'];
        $y = (int)$input['year'];

        // Валідація: перевіряємо, чи існує така дата в календарі (наприклад, щоб не було 30 лютого)
        if (!checkdate($m, $d, $y)) {
            echo json_encode(['success' => false, 'message' => 'Некоректна дата']);
            exit;
        }

        // Формуємо дату у форматі YYYY-MM-DD (додаємо нулі: 2005-05-01)
        $dateString = sprintf("%04d-%02d-%02d", $y, $m, $d);
        
        $stmt = $pdo->prepare("UPDATE users SET birthday = ? WHERE id = ?");
        $stmt->execute([$dateString, $userId]);
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Дані не повні']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>