<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_set_cookie_params(['lifetime'=>86400,'path'=>'/','secure'=>false,'httponly'=>true,'samesite'=>'Lax']);
session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) { echo json_encode(['success'=>false,'tutorial_done'=>false]); exit; }

try {
    $pdo = new PDO("mysql:host=my-mysql;dbname=mywebsite;charset=utf8", 'root', 'root', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    
    // Try to get column; if doesn't exist yet, return false
    try {
        $stmt = $pdo->prepare("SELECT tutorial_done FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $done = $row && $row['tutorial_done'] == 1;
    } catch (Exception $inner) {
        $done = false;
    }
    
    echo json_encode(['success'=>true,'tutorial_done'=>$done]);
} catch (Exception $e) {
    echo json_encode(['success'=>false,'tutorial_done'=>false,'message'=>$e->getMessage()]);
}