<?php
// upload_banner.php — ЗАХИЩЕНА ВЕРСІЯ (за зразком upload_avatar.php)
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

$userId = (int)$_SESSION['user_id'];

// ── Цей скрипт приймає тільки банер
$fileKey   = 'banner';
$subFolder = 'banners';
$column    = 'banner_url';

if (!isset($_FILES[$fileKey])) {
    echo json_encode(['success' => false, 'error' => 'Файл не отримано']);
    exit;
}

$fileError = $_FILES[$fileKey]['error'] ?? UPLOAD_ERR_NO_FILE;
if ($fileError !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'Помилка завантаження файлу']);
    exit;
}

// ── Перевірка розміру (до 15 МБ — як на фронтенді)
$maxSize = 15 * 1024 * 1024;
if ($_FILES[$fileKey]['size'] > $maxSize) {
    echo json_encode(['success' => false, 'error' => 'Файл занадто великий. Максимум 15 МБ']);
    exit;
}

// ── MIME-тип перевіряємо через finfo (НЕ через розширення!)
$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
];

$finfo    = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($_FILES[$fileKey]['tmp_name']);

if (!isset($allowedMimes[$mimeType])) {
    echo json_encode(['success' => false, 'error' => 'Дозволені тільки зображення: jpg, png, gif, webp']);
    exit;
}

// ── Розширення беремо з MIME, не з оригінального імені файлу
$extension = $allowedMimes[$mimeType];

// ── Додатково: перевіряємо магічні байти зображення
if (!@getimagesize($_FILES[$fileKey]['tmp_name'])) {
    echo json_encode(['success' => false, 'error' => 'Невалідний файл зображення']);
    exit;
}

// ── Генеруємо безпечне ім'я файлу (без оригінального імені!)
$uploadBase = 'uploads/' . $subFolder . '/';
$serverPath = __DIR__ . '/' . $uploadBase;

if (!is_dir($serverPath)) {
    if (!mkdir($serverPath, 0750, true)) {
        echo json_encode(['success' => false, 'error' => 'Не вдалося створити папку']);
        exit;
    }
}

// Видаляємо старий файл цього юзера (щоб не накопичувалось)
$pattern = $serverPath . $subFolder . '_' . $userId . '_*';
foreach (glob($pattern) as $oldFile) {
    @unlink($oldFile);
}

$fileName   = $subFolder . '_' . $userId . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
$targetFile = $serverPath . $fileName;
$dbUrl      = $uploadBase . $fileName;

if (!move_uploaded_file($_FILES[$fileKey]['tmp_name'], $targetFile)) {
    echo json_encode(['success' => false, 'error' => 'Не вдалося зберегти файл']);
    exit;
}

// Дозволи: тільки читання (не виконання!)
chmod($targetFile, 0644);

// ── Запис в БД
try {
    require_once __DIR__ . '/db_connect.php';

    $stmt = $pdo->prepare("UPDATE users SET `banner_url` = ? WHERE id = ?");
    $stmt->execute([$dbUrl, $userId]);

    echo json_encode(['success' => true, 'url' => $dbUrl]);

} catch (Exception $e) {
    error_log('Upload banner DB error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Помилка сервера']);
}