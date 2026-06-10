<?php
error_reporting(0);
ini_set('display_errors', 0);

require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Не авторизовано']);
    exit;
}

$userId = (int)$_SESSION['user_id'];

// 1. Визначаємо тип файлу та папку
$fileKey   = null;
$subFolder = '';

if (isset($_FILES['banner']))         { $fileKey = 'banner';     $subFolder = 'banners'; }
elseif (isset($_FILES['avatar']))     { $fileKey = 'avatar';     $subFolder = 'avatars'; }
elseif (isset($_FILES['background'])) { $fileKey = 'background'; $subFolder = 'backgrounds'; }

if (!$fileKey) {
    echo json_encode(['success' => false, 'error' => 'Файл не отримано (невідомий тип)']);
    exit;
}

$fileError = $_FILES[$fileKey]['error'] ?? UPLOAD_ERR_NO_FILE;
if ($fileError !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE   => 'Файл перевищує upload_max_filesize у php.ini',
        UPLOAD_ERR_FORM_SIZE  => 'Файл перевищує MAX_FILE_SIZE форми',
        UPLOAD_ERR_PARTIAL    => 'Файл завантажено частково',
        UPLOAD_ERR_NO_FILE    => 'Файл не надіслано',
        UPLOAD_ERR_NO_TMP_DIR => 'Відсутня тимчасова папка',
        UPLOAD_ERR_CANT_WRITE => 'Не вдалося записати файл на диск',
    ];
    $msg = $errorMessages[$fileError] ?? "PHP upload error code: $fileError";
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

// 2. СПОЧАТКУ перевірка розміру (до 15 МБ)
$maxSize = 15 * 1024 * 1024;
if ($_FILES[$fileKey]['size'] > $maxSize) {
    echo json_encode(['success' => false, 'error' => 'Файл занадто великий. Максимум 15 МБ']);
    exit;
}

// 3. Потім перевірка розширення
$extension = strtolower(pathinfo($_FILES[$fileKey]['name'], PATHINFO_EXTENSION));
if (!in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
    echo json_encode(['success' => false, 'error' => 'Дозволені тільки зображення: jpg, png, gif, webp']);
    exit;
}

// 4. Шляхи
$uploadBase = 'uploads/' . $subFolder . '/';
$serverPath = __DIR__ . '/' . $uploadBase;

if (!is_dir($serverPath)) {
    if (!mkdir($serverPath, 0775, true)) {
        echo json_encode(['success' => false, 'error' => 'Не вдалося створити папку: ' . $serverPath]);
        exit;
    }
}

if (!is_writable($serverPath)) {
    echo json_encode(['success' => false, 'error' => 'Папка недоступна для запису: ' . $serverPath]);
    exit;
}

$fileName   = $subFolder . '_' . $userId . '_' . time() . '.' . $extension;
$targetFile = $serverPath . $fileName;
$dbUrl      = $uploadBase . $fileName;

// 5. Переміщення файлу
if (!move_uploaded_file($_FILES[$fileKey]['tmp_name'], $targetFile)) {
    echo json_encode(['success' => false, 'error' => 'move_uploaded_file не вдався']);
    exit;
}

chmod($targetFile, 0644);

// 6. Запис в БД
try {
    require_once __DIR__ . '/db_connect.php';

    // Захист: дозволяємо тільки відомі колонки
    $allowedColumns = ['avatar_url', 'banner_url', 'background_url'];
    $column = $fileKey . '_url';
    if (!in_array($column, $allowedColumns)) {
        echo json_encode(['success' => false, 'error' => 'Невідома колонка']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE users SET `$column` = ? WHERE id = ?");
    $stmt->execute([$dbUrl, $userId]);

    echo json_encode(['success' => true, 'url' => $dbUrl]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Файл збережено, але помилка БД: ' . $e->getMessage()]);
}
?>
