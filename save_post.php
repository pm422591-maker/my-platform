<?php
// save_post.php — ВИПРАВЛЕНА ВЕРСІЯ
require_once __DIR__ . '/cors_session.php';
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

// ── Rate limit для постів
if (!checkRateLimit('save_post', 10, 60)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Забагато постів. Зачекайте хвилину.']);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$userId = (int)$_SESSION['user_id'];

try {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data) {
        echo json_encode(['success' => false, 'message' => 'Немає даних']);
        exit;
    }

    // ── Валідація та обрізка всіх рядкових полів
    $title     = mb_substr(trim($data['title'] ?? ''), 0, 200);
    $body      = mb_substr(trim($data['body'] ?? ''), 0, 5000);
    $group     = mb_substr(trim($data['group'] ?? 'all'), 0, 50);
    $type      = mb_substr(trim($data['type'] ?? 'default'), 0, 30);
    $mention   = isset($data['mention']) ? mb_substr(trim($data['mention']), 0, 50) : null;
    $songTitle  = isset($data['songTitle'])  ? mb_substr(trim($data['songTitle']), 0, 200) : null;
    $songArtist = isset($data['songArtist']) ? mb_substr(trim($data['songArtist']), 0, 200) : null;
    $songImg    = isset($data['songImg'])    ? mb_substr(trim($data['songImg']), 0, 500) : null;
    $songUrl    = isset($data['songUrl'])    ? mb_substr(trim($data['songUrl']), 0, 500) : null;

    // Whitelist для фільтрів
    $allowedAges  = ['any', '13+', '16+', '18+'];
    $allowedComms = ['any', 'casual', 'serious'];
    $allowedLevels = ['any', 'beginner', 'intermediate', 'advanced'];
    $allowedColors = ['pink', 'blue', 'green', 'purple', 'orange', 'red', 'yellow'];

    $filter_age  = in_array($data['filter_age'] ?? '', $allowedAges, true)   ? $data['filter_age']  : 'any';
    $filter_comm = in_array($data['filter_comm'] ?? '', $allowedComms, true)  ? $data['filter_comm'] : 'any';
    $filter_level = in_array($data['filter_level'] ?? '', $allowedLevels, true) ? $data['filter_level'] : 'any';
    $filter_lang = mb_substr(trim($data['filter_lang'] ?? 'any'), 0, 10);
    $color       = in_array($data['color'] ?? '', $allowedColors, true) ? $data['color'] : 'pink';

    // ── КРИТИЧНО: НЕ зберігаємо Base64 зображення в БД!
    // Base64 картинки в БД — це неправильно: роздуває базу, уповільнює запити.
    // Замість цього post_image має бути URL до файлу в uploads/.
    // Якщо image передається як Base64 — ігноруємо або обробляємо окремо.
    $post_image = null;
    if (!empty($data['image'])) {
        $imgVal = $data['image'];
        // Якщо це URL (не Base64) — зберігаємо
        if (!str_starts_with($imgVal, 'data:')) {
            $post_image = mb_substr($imgVal, 0, 500);
        }
        // Base64 — ігноруємо. Для завантаження зображень використовуй окремий upload endpoint.
    }

    // Отримуємо реальні дані автора з БД (не довіряємо даним від клієнта!)
    $stmtUser = $pdo->prepare("SELECT username, avatar_url FROM users WHERE id = ?");
    $stmtUser->execute([$userId]);
    $userRow = $stmtUser->fetch();
    $authorName = $userRow['username'] ?? 'Анонім';
    $avatarUrl  = $userRow['avatar_url'] ?? 'img/default_avatar.png';

    $sql = "INSERT INTO posts 
            (user_id, author_name, avatar_url, post_image, title, body, group_name, post_type, 
             song_title, song_artist, song_img, song_url, mention_user, 
             filter_age, filter_comm, filter_level, filter_lang, post_color) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $userId,
        $authorName, // З БД, не від клієнта!
        $avatarUrl,  // З БД, не від клієнта!
        $post_image,
        $title,
        $body,
        $group,
        $type,
        $songTitle,
        $songArtist,
        $songImg,
        $songUrl,
        $mention,
        $filter_age,
        $filter_comm,
        $filter_level,
        $filter_lang,
        $color,
    ]);

    echo json_encode(['success' => true, 'post_id' => (int)$pdo->lastInsertId()]);

} catch (Exception $e) {
    error_log('Save post error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}