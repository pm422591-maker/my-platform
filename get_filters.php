<?php
// get_filters.php
header("Content-Type: application/json");
session_start();

$host = 'my-mysql'; $db = 'mywebsite'; $user = 'root'; $pass = 'root';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false]);
    exit;
}

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);

$stmt = $pdo->prepare("SELECT age, comm_style, skill_level, language FROM user_filters WHERE user_id = ?");
$stmt->execute([$_SESSION['user_id']]);
$filters = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$filters) {
    $filters = [
        'age' => 'any',
        'comm_style' => 'any',
        'skill_level' => 'any',
        'language' => 'any'
    ];
}

$filters['success'] = true;
echo json_encode($filters);
?>