<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

$current_user_id = (int)$_SESSION['user_id'];

// Оскільки ми тепер відправляємо FormData, дані лежать у $_POST, а не в json
$receiver_id = isset($_POST['receiver_id']) ? (int)$_POST['receiver_id'] : 0;
$text = isset($_POST['text']) ? trim($_POST['text']) : '';
$media_type = isset($_POST['media_type']) ? $_POST['media_type'] : 'text';

if ($receiver_id === 0) {
    echo json_encode(['success' => false, 'message' => 'Немає отримувача']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // Перевірка на блокування
    $check_block = $pdo->prepare("SELECT id FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)");
    $check_block->execute([$current_user_id, $receiver_id, $receiver_id, $current_user_id]);

    if ($check_block->rowCount() > 0) {
        echo json_encode(['success' => false, 'message' => 'Повідомлення заблоковано']);
        exit;
    }

    $media_url = null;

    // Якщо прикріплено файл (фото або аудіо)
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $upload_dir = 'uploads/chat/';
        if (!is_dir($upload_dir)) mkdir($upload_dir, 0777, true);
        
        $file_tmp = $_FILES['file']['tmp_name'];
        $file_name = time() . '_' . uniqid() . '_' . basename($_FILES['file']['name']);
        
        // Для голосових повідомлень (вони записуються як blob)
        if ($media_type === 'audio' && empty($_FILES['file']['name'])) {
            $file_name = time() . '_' . uniqid() . '.webm';
        }

        $target_path = $upload_dir . $file_name;

        if (move_uploaded_file($file_tmp, $target_path)) {
            $media_url = $target_path;
        }
    }

    // Якщо немає ні тексту, ні файлу — відхиляємо
    if (empty($text) && empty($media_url)) {
        echo json_encode(['success' => false, 'message' => 'Порожнє повідомлення']);
        exit;
    }

    // Зберігаємо в базу
    $stmt = $pdo->prepare("INSERT INTO messages (sender_id, receiver_id, message, media_type, media_url) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$current_user_id, $receiver_id, $text, $media_type, $media_url]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>