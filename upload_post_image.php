<?php
// upload_post_image.php — ЗАВАНТАЖЕННЯ ФОТО ДЛЯ ПОСТА
// Приймає або multipart-файл (поле "image"), або JSON з Base64 data-URL ({ "image": "data:image/...;base64,..." }).
// Зберігає файл у uploads/posts/ та повертає URL, який потім іде в save_post.php як post_image.
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Не авторизовано']);
    exit;
}

// ── Rate limit: до 20 завантажень на хвилину
if (function_exists('checkRateLimit') && !checkRateLimit('upload_post_image', 20, 60)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Забагато завантажень. Зачекайте хвилину.']);
    exit;
}

$userId = (int)$_SESSION['user_id'];

$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
];
$maxSize = 5 * 1024 * 1024; // 5 МБ

// ── Готуємо папку призначення
$uploadBase = 'uploads/posts/';
$serverPath = __DIR__ . '/' . $uploadBase;
if (!is_dir($serverPath)) {
    if (!mkdir($serverPath, 0750, true)) {
        echo json_encode(['success' => false, 'error' => 'Не вдалося створити папку']);
        exit;
    }
}

$tmpFile  = null;   // тимчасовий файл, який треба перемістити/видалити
$isUploaded = false; // true, якщо це move_uploaded_file

// ── Варіант 1: класичний multipart-файл
if (isset($_FILES['image'])) {
    if (($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'error' => 'Помилка завантаження файлу']);
        exit;
    }
    if ($_FILES['image']['size'] > $maxSize) {
        echo json_encode(['success' => false, 'error' => 'Файл занадто великий. Максимум 5 МБ']);
        exit;
    }
    $tmpFile = $_FILES['image']['tmp_name'];
    $isUploaded = true;
} else {
    // ── Варіант 2: Base64 data-URL у JSON
    $data = json_decode(file_get_contents('php://input'), true);
    $dataUrl = $data['image'] ?? '';

    if (!is_string($dataUrl) || strpos($dataUrl, 'data:') !== 0) {
        echo json_encode(['success' => false, 'error' => 'Не отримано зображення']);
        exit;
    }

    // Розбираємо data:image/png;base64,XXXX
    if (!preg_match('#^data:([^;]+);base64,(.+)$#s', $dataUrl, $m)) {
        echo json_encode(['success' => false, 'error' => 'Невалідний формат зображення']);
        exit;
    }

    $binary = base64_decode($m[2], true);
    if ($binary === false) {
        echo json_encode(['success' => false, 'error' => 'Невалідні дані зображення']);
        exit;
    }
    if (strlen($binary) > $maxSize) {
        echo json_encode(['success' => false, 'error' => 'Файл занадто великий. Максимум 5 МБ']);
        exit;
    }

    // Пишемо у тимчасовий файл, щоб перевірити MIME реальним способом
    $tmpFile = tempnam(sys_get_temp_dir(), 'post_img_');
    if ($tmpFile === false || file_put_contents($tmpFile, $binary) === false) {
        echo json_encode(['success' => false, 'error' => 'Не вдалося обробити файл']);
        exit;
    }
}

// ── MIME перевіряємо через finfo (НЕ довіряємо заголовку від клієнта)
$finfo    = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($tmpFile);

if (!isset($allowedMimes[$mimeType]) || !@getimagesize($tmpFile)) {
    if (!$isUploaded) @unlink($tmpFile);
    echo json_encode(['success' => false, 'error' => 'Дозволені тільки зображення: jpg, png, gif, webp']);
    exit;
}

$extension  = $allowedMimes[$mimeType];
$fileName   = 'post_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $extension;
$targetFile = $serverPath . $fileName;
$dbUrl      = $uploadBase . $fileName;

$ok = $isUploaded
    ? move_uploaded_file($tmpFile, $targetFile)
    : rename($tmpFile, $targetFile);

if (!$ok) {
    if (!$isUploaded) @unlink($tmpFile);
    echo json_encode(['success' => false, 'error' => 'Не вдалося зберегти файл']);
    exit;
}

@chmod($targetFile, 0644);

echo json_encode(['success' => true, 'url' => $dbUrl]);
