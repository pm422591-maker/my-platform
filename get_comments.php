<?php
// Дозволяємо запити з будь-якого локального хоста
header("Access-Control-Allow-Origin: " . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header("Access-Control-Allow-Credentials: true");
header('Content-Type: application/json; charset=utf-8');

session_start();
$host = 'my-mysql';
$db = 'mywebsite'; 
$user = 'root'; 
$pass = 'root'; 

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);

    if (!isset($_GET['post_id']) || empty($_GET['post_id'])) {
        echo json_encode([]);
        exit;
    }

    $post_id = intval($_GET['post_id']);
    $user_id = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : 0;
    
    // Отримуємо тип сортування (new або popular)
    $sort = $_GET['sort'] ?? 'new';

    // Визначаємо правило ORDER BY
    // За замовчуванням: спочатку найновіші (DESC)
    $orderBy = "c.id DESC"; 

    if ($sort === 'popular') {
        // Сортуємо за кількістю голосів, а якщо вони однакові — за часом
        $orderBy = "vote_count DESC, c.id DESC";
    }

    // Основний запит
    $query = "
        SELECT c.*,
               (SELECT COALESCE(SUM(vote_type), 0) FROM comment_votes WHERE comment_id = c.id) as vote_count,
               (SELECT COALESCE(vote_type, 0) FROM comment_votes WHERE comment_id = c.id AND user_id = :user_id) as my_vote
        FROM comments c
        WHERE c.post_id = :post_id
        ORDER BY $orderBy
    ";

    $stmt = $pdo->prepare($query);
    $stmt->execute([
        'post_id' => $post_id,
        'user_id' => $user_id
    ]);
    
    $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($comments);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Помилка БД: ' . $e->getMessage()]);
}
?>