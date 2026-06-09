<?php
// Вимикаємо HTML-помилки ДО будь-якого виводу
error_reporting(0);
ini_set('display_errors', 0);

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Не авторизовано']);
    exit;
}

$userId = $_SESSION['user_id'];

// 1. Визначаємо тип файлу та папку
$fileKey   = null;
$subFolder = '';

if (isset($_FILES['banner']))     { $fileKey = 'banner';     $subFolder = 'banners'; }
elseif (isset($_FILES['avatar'])) { $fileKey = 'avatar';     $subFolder = 'avatars'; }
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

// 2. Перевірка розширення
$extension = strtolower(pathinfo($_FILES[$fileKey]['name'], PATHINFO_EXTENSION));
if (!in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
    // Перевірка розміру — максимум 15 МБ
$maxSize = 15 * 1024 * 1024; // 15 MB в байтах
if ($_FILES[$fileKey]['size'] > $maxSize) {
    echo json_encode(['success' => false, 'error' => 'Файл занадто великий. Максимум 15 МБ']);
    exit;
}
    echo json_encode(['success' => false, 'error' => 'Дозволені тільки зображення: jpg, png, gif, webp']);
    exit;
}

// 3. Шляхи — uploads/ відносно кореня сайту (/var/www/html)
$uploadBase = 'uploads/' . $subFolder . '/';
$serverPath = __DIR__ . '/' . $uploadBase;

// Створюємо папку якщо немає
if (!is_dir($serverPath)) {
    if (!mkdir($serverPath, 0777, true)) {
        echo json_encode(['success' => false, 'error' => 'Не вдалося створити папку: ' . $serverPath]);
        exit;
    }
    chmod($serverPath, 0777);
}

// Перевіряємо права на запис
if (!is_writable($serverPath)) {
    echo json_encode(['success' => false, 'error' => 'Папка недоступна для запису: ' . $serverPath]);
    exit;
}

$fileName   = $subFolder . '_' . $userId . '_' . time() . '.' . $extension;
$targetFile = $serverPath . $fileName;
$dbUrl      = $uploadBase . $fileName; // uploads/banners/banners_1_xxx.jpg

// 4. Переміщення файлу
if (!move_uploaded_file($_FILES[$fileKey]['tmp_name'], $targetFile)) {
    echo json_encode(['success' => false, 'error' => 'move_uploaded_file не вдався. tmp=' . $_FILES[$fileKey]['tmp_name'] . ' target=' . $targetFile]);
    exit;
}

chmod($targetFile, 0644);

// 5. Запис в БД
try {
    $pdo = new PDO('mysql:host=my-mysql;dbname=mywebsite;charset=utf8', 'root', 'root', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $column = $fileKey . '_url';
    $stmt = $pdo->prepare("UPDATE users SET `$column` = ? WHERE id = ?");
    $stmt->execute([$dbUrl, $userId]);

    echo json_encode(['success' => true, 'url' => $dbUrl]);

} catch (Exception $e) {
    // Файл вже завантажено, але БД не вдалось — повідомляємо детально
    echo json_encode(['success' => false, 'error' => 'Файл збережено, але помилка БД: ' . $e->getMessage()]);
}
?>