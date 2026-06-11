<?php
// 1. Налаштування CORS (дуже важливо для сесій!)
require_once __DIR__ . '/cors_session.php';
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

session_start();
header('Content-Type: application/json; charset=utf-8');

$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: ''; 

try {
    // Використовуємо utf8mb4 для підтримки емодзі в текстах!
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $data = json_decode(file_get_contents("php://input"), true);
    
    // ПЕРЕВІРКА СЕСІЇ: беремо ID суворо як число
    $userId = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;

    if (!$userId) {
        echo json_encode(['success' => false, 'message' => 'Помилка: Ви не авторизовані. Сесія не знайдена.']);
        exit;
    }

    if ($data) {
        // ✨ ОНОВЛЕНО: додано нові колонки замість filter_style
        $sql = "INSERT INTO posts 
                (user_id, author_name, avatar_url, post_image, title, body, group_name, post_type, 
                 song_title, song_artist, song_img, song_url, mention_user, 
                 filter_age, filter_comm, filter_level, filter_lang, post_color) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $pdo->prepare($sql);

        // Виконуємо запит
        $stmt->execute([
            $userId,                       // Вже точно число, не порожньо!
            $data['author'] ?? 'Анонім',
            $data['avatar'] ?? 'img/default_avatar.png',
            $data['image'] ?? null,        // Твоє фото в Base64
            $data['title'] ?? '',
            $data['body'] ?? '',
            $data['group'] ?? 'all',
            $data['type'] ?? 'default',
            $data['songTitle'] ?? null,
            $data['songArtist'] ?? null,
            $data['songImg'] ?? null,
            $data['songUrl'] ?? null,
            $data['mention'] ?? null,
            
            // ✨ ОНОВЛЕНО: беремо нові ключі з JSON, які ми надсилаємо з JS
            $data['filter_age'] ?? 'any',
            $data['filter_comm'] ?? 'any',
            $data['filter_level'] ?? 'any',
            $data['filter_lang'] ?? 'any',
            
            $data['color'] ?? 'pink'
        ]);

        echo json_encode(['success' => true, 'post_id' => $pdo->lastInsertId()]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Немає даних для збереження']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>