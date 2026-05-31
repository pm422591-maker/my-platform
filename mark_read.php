<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо зайві помилки, щоб вони не ламали JSON відповідь
error_reporting(0);
ini_set('display_errors', 0);

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

// 1. СТВОРЮЄМО ФАКТИЧНЕ ПІДКЛЮЧЕННЯ ДО БД
$conn = new mysqli($host, $user, $pass, $db);

// Перевіряємо, чи підключилося успішно
if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Встановлюємо правильне кодування, щоб не було проблем з емодзі
$conn->set_charset("utf8mb4");

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not authorized']);
    exit;
}

$my_id = $_SESSION['user_id'];
// Використовуємо $_REQUEST, щоб ловити і GET, і POST
$target_id = isset($_REQUEST['target_id']) ? intval($_REQUEST['target_id']) : 0;

if ($target_id > 0) {
    // Шукаємо повідомлення ВІД співрозмовника ДО нас, які ще не прочитані
    $stmt = $conn->prepare("UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0");
    
    if ($stmt) {
        $stmt->bind_param("ii", $target_id, $my_id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'updated_rows' => $stmt->affected_rows]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $stmt->error]);
        }
        $stmt->close();
    } else {
        echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid target ID']);
}

$conn->close();
?>