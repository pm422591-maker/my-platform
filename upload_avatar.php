<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Не авторизовано']);
    exit;
}

$userId = $_SESSION['user_id'];

// 1. Визначаємо тип файлу та папку
$fileKey = null;
$subFolder = '';

if (isset($_FILES['banner'])) {
    $fileKey = 'banner';
    $subFolder = 'banners';
} elseif (isset($_FILES['avatar'])) {
    $fileKey = 'avatar';
    $subFolder = 'avatars';
} elseif (isset($_FILES['background'])) {
    $fileKey = 'background';
    $subFolder = 'backgrounds';
}

if (!$fileKey || $_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'Файл не отримано']);
    exit;
}

// 2. Налаштування шляхів
// Повний шлях до папки: uploads/banners/
$uploadBase = 'uploads/' . $subFolder . '/';
$serverPath = __DIR__ . '/' . $uploadBase;

// Створюємо папку, якщо її немає (рекурсивно)
if (!is_dir($serverPath)) {
    mkdir($serverPath, 0777, true);
    chmod($serverPath, 0777);
}

// Генеруємо ім'я файлу
$extension = strtolower(pathinfo($_FILES[$fileKey]['name'], PATHINFO_EXTENSION));
if (!in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
    echo json_encode(['success' => false, 'error' => 'Тільки картинки']);
    exit;
}

$fileName = $subFolder . "_" . $userId . "_" . time() . "." . $extension;
$targetFile = $serverPath . $fileName; // Фізичний шлях
$dbUrl = $uploadBase . $fileName;      // Шлях для бази: uploads/banners/file.jpg

// 3. Збереження
if (move_uploaded_file($_FILES[$fileKey]['tmp_name'], $targetFile)) {
    
    // Даємо права файлу
    chmod($targetFile, 0666);

    try {
        $pdo = new PDO("mysql:host=my-mysql;dbname=mywebsite;charset=utf8", "root", "root");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $column = $fileKey . '_url';
        
        // Зберігаємо ПОВНИЙ відносний шлях: uploads/banners/file.jpg
        $stmt = $pdo->prepare("UPDATE users SET `$column` = ? WHERE id = ?");
        $stmt->execute([$dbUrl, $userId]);

        echo json_encode([
            'success' => true,
            'url' => $dbUrl // Повертаємо uploads/banners/file.jpg
        ]);

    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Помилка БД: ' . $e->getMessage()]);
    }

} else {
    echo json_encode(['success' => false, 'error' => 'Не вдалося перемістити файл']);
}
?>