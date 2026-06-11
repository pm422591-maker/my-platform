<?php
// save_blog.php — ВИПРАВЛЕНА ВЕРСІЯ
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

require_once __DIR__ . '/db_connect.php';

$userId      = (int)$_SESSION['user_id'];
$title       = mb_substr(trim($_POST['title'] ?? ''), 0, 100);
$description = mb_substr(trim($_POST['description'] ?? ''), 0, 1000);
$privacy     = in_array($_POST['privacy'] ?? '', ['public', 'private', 'friends'], true) ? $_POST['privacy'] : 'public';
$bgColor     = preg_match('/^#[0-9a-fA-F]{3,6}$/', $_POST['bg_color'] ?? '') ? $_POST['bg_color'] : '#f0047f';
$slug        = preg_replace('/[^a-z0-9_-]/', '', strtolower(trim($_POST['slug'] ?? '')));
$slug        = mb_substr($slug, 0, 60);

if (empty($title)) {
    echo json_encode(['success' => false, 'message' => 'Назва блогу обов\'язкова']);
    exit;
}

if (empty($slug)) {
    $slug = 'blog_' . $userId . '_' . rand(1000, 9999);
}

try {
    // Перевірка унікальності slug
    $stmtSlug = $pdo->prepare("SELECT id FROM blogs WHERE slug = ? AND user_id != ?");
    $stmtSlug->execute([$slug, $userId]);
    if ($stmtSlug->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Це посилання вже зайняте!']);
        exit;
    }

    $imagePath = null;

    // ── Завантаження картинки З перевіркою MIME (була відсутня!)
    if (isset($_FILES['bg_image']) && $_FILES['bg_image']['error'] === UPLOAD_ERR_OK) {
        if ($_FILES['bg_image']['size'] > 5 * 1024 * 1024) {
            echo json_encode(['success' => false, 'message' => 'Картинка занадто велика (максимум 5 МБ)']);
            exit;
        }

        $allowedMimes = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/gif'  => 'gif',
            'image/webp' => 'webp',
        ];

        $finfo    = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($_FILES['bg_image']['tmp_name']);

        if (!isset($allowedMimes[$mimeType])) {
            echo json_encode(['success' => false, 'message' => 'Дозволені лише зображення (jpg, png, gif, webp)']);
            exit;
        }

        if (!@getimagesize($_FILES['bg_image']['tmp_name'])) {
            echo json_encode(['success' => false, 'message' => 'Невалідний файл зображення']);
            exit;
        }

        $ext        = $allowedMimes[$mimeType];
        $uploadDir  = __DIR__ . '/uploads/blogs/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0750, true); // 0750, не 0777!
        }

        // Безпечне ім'я без оригінального basename
        $fileName       = 'blog_' . $userId . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $targetFilePath = $uploadDir . $fileName;

        if (move_uploaded_file($_FILES['bg_image']['tmp_name'], $targetFilePath)) {
            chmod($targetFilePath, 0644);
            $imagePath = 'uploads/blogs/' . $fileName;
        }
    }

    $stmtCheck = $pdo->prepare("SELECT id, bg_image FROM blogs WHERE user_id = ?");
    $stmtCheck->execute([$userId]);
    $existingBlog = $stmtCheck->fetch();

    if ($existingBlog) {
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
    error_log('Save blog error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}