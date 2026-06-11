<?php
// save_filters.php
header("Content-Type: application/json");
session_start();

$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$data = json_decode(file_get_contents('php://input'), true);

$user_id = $_SESSION['user_id'];
$age = $data['age'] ?? 'any';
$comm_style = $data['comm_style'] ?? 'any';
$skill_level = $data['skill_level'] ?? 'any';
$language = $data['language'] ?? 'any';

try {
    $stmt = $pdo->prepare("
        INSERT INTO user_filters (user_id, age, comm_style, skill_level, language) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        age = VALUES(age), 
        comm_style = VALUES(comm_style), 
        skill_level = VALUES(skill_level), 
        language = VALUES(language)
    ");
    $stmt->execute([$user_id, $age, $comm_style, $skill_level, $language]);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>