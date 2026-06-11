<?php
// save_message.php — ВИПРАВЛЕНА ВЕРСІЯ
session_start();
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/cors_session.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

// ── Rate limit для повідомлень: 60 / хвилину
if (!checkRateLimit('messages', 60, 60)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Забагато повідомлень. Зачекайте хвилину.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$current_user_id = (int)$_SESSION['user_id'];
$receiver_id     = isset($_POST['receiver_id']) ? (int)$_POST['receiver_id'] : 0;
$text            = isset($_POST['text']) ? mb_substr(trim($_POST['text']), 0, 2000) : '';
$media_type      = isset($_POST['media_type']) ? $_POST['media_type'] : 'text';

// Whitelist media_type
$allowedMediaTypes = ['text', 'image', 'audio', 'video'];
if (!in_array($media_type, $allowedMediaTypes, true)) {
    $media_type = 'text';
}

if ($receiver_id === 0) {
    echo json_encode(['success' => false, 'message' => 'Немає отримувача']);
    exit;
}

try {
    // Перевірка блокування
    $check_block = $pdo->prepare(
        "SELECT id FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)"
    );
    $check_block->execute([$current_user_id, $receiver_id, $receiver_id, $current_user_id]);
    if ($check_block->rowCount() > 0) {
        echo json_encode(['success' => false, 'message' => 'Повідомлення заблоковано']);
        exit;
    }

    $media_url = null;

    // ── Завантаження файлу З перевіркою MIME (була відсутня!)
    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $maxFileSize = 10 * 1024 * 1024; // 10 МБ
        if ($_FILES['file']['size'] > $maxFileSize) {
            echo json_encode(['success' => false, 'message' => 'Файл занадто великий (максимум 10 МБ)']);
            exit;
        }

        // Перевірка MIME через finfo (не через розширення!)
        $allowedMimes = [
            'image/jpeg'  => 'jpg',
            'image/png'   => 'png',
            'image/gif'   => 'gif',
            'image/webp'  => 'webp',
            'audio/webm'  => 'webm',
            'audio/ogg'   => 'ogg',
            'audio/mpeg'  => 'mp3',
            'video/webm'  => 'webm',
        ];

        $finfo    = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($_FILES['file']['tmp_name']);

        if (!isset($allowedMimes[$mimeType])) {
            echo json_encode(['success' => false, 'message' => 'Дозволені лише зображення та аудіо/відео файли']);
            exit;
        }

        $ext        = $allowedMimes[$mimeType];
        $upload_dir = __DIR__ . '/uploads/chat/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0750, true); // 0750, не 0777!
        }

        // Безпечне ім'я файлу — без оригінального імені!
        $file_name   = time() . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $target_path = $upload_dir . $file_name;

        if (move_uploaded_file($_FILES['file']['tmp_name'], $target_path)) {
            chmod($target_path, 0644);
            $media_url = 'uploads/chat/' . $file_name;
        }
    }

    if (empty($text) && empty($media_url)) {
        echo json_encode(['success' => false, 'message' => 'Порожнє повідомлення']);
        exit;
    }

    $stmt = $pdo->prepare(
        "INSERT INTO messages (sender_id, receiver_id, message, media_type, media_url) VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([$current_user_id, $receiver_id, $text, $media_type, $media_url]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    error_log('Save message error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}