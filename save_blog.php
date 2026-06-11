<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $userId = $_SESSION['user_id'];
    
    // Отримуємо дані з POST (через FormData з JS)
    $title = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $privacy = $_POST['privacy'] ?? 'public';
    $bgColor = $_POST['bg_color'] ?? '#f0047f';
    $slug = trim($_POST['slug'] ?? '');

    if (empty($title)) {
        echo json_encode(['success' => false, 'message' => 'Назва блогу обов\'язкова']);
        exit;
    }

    if (empty($slug)) {
        $slug = 'blog_' . $userId . '_' . rand(1000, 9999);
    }

    // Перевірка унікальності посилання
    $stmtSlug = $pdo->prepare("SELECT id FROM blogs WHERE slug = ? AND user_id != ?");
    $stmtSlug->execute([$slug, $userId]);
    if ($stmtSlug->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Це посилання вже зайняте! Виберіть інше.']);
        exit;
    }

    // ОБРОБКА КАРТИНКИ
    $imagePath = null;
    if (isset($_FILES['bg_image']) && $_FILES['bg_image']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = 'uploads/blogs/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true); // Створюємо папку, якщо її немає
        }
        
        // Генеруємо унікальне ім'я для файлу, щоб уникнути конфліктів
        $fileName = uniqid() . '_' . basename($_FILES['bg_image']['name']);
        $targetFilePath = $uploadDir . $fileName;
        
        // Зберігаємо файл на сервері
        if (move_uploaded_file($_FILES['bg_image']['tmp_name'], $targetFilePath)) {
            $imagePath = $targetFilePath;
        }
    }

    // Перевіряємо, чи існує блог
    $stmtCheck = $pdo->prepare("SELECT id, bg_image FROM blogs WHERE user_id = ?");
    $stmtCheck->execute([$userId]);
    $existingBlog = $stmtCheck->fetch();

    if ($existingBlog) {
        // Якщо користувач не завантажив нову картинку, залишаємо стару
        if ($imagePath === null) {
            $imagePath = $existingBlog['bg_image'];
        }
        
        $stmt = $pdo->prepare("UPDATE blogs SET title=?, description=?, privacy=?, bg_color=?, slug=?, bg_image=? WHERE user_id=?");
        $stmt->execute([$title, $description, $privacy, $bgColor, $slug, $imagePath, $userId]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO blogs (user_id, title, description, privacy, bg_color, slug, bg_image) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $title, $description, $privacy, $bgColor, $slug, $imagePath]);
    }

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>