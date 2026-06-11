<?php
// add_comment.php
header('Content-Type: application/json');
session_start();
if (!isset($_SESSION['user_id'])) die(json_encode(['success' => false, 'message' => 'Login required']));

$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: '';
$data = json_decode(file_get_contents('php://input'), true);

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    $stmt = $pdo->prepare("INSERT INTO comments (post_id, user_id, parent_id, author_name, avatar_url, body) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $data['post_id'],
        $_SESSION['user_id'],
        $data['parent_id'] ?? null,
        $_SESSION['user_name'] ?? 'Gamer',
        $_SESSION['user_avatar'] ?? '',
        $data['text']
    ]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}