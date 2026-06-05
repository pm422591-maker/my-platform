<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_set_cookie_params(['lifetime'=>86400,'path'=>'/','secure'=>false,'httponly'=>true,'samesite'=>'Lax']);
session_start();

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) { echo json_encode(['success'=>false,'message'=>'Not authorized']); exit; }

try {
    $pdo = new PDO("mysql:host=my-mysql;dbname=mywebsite;charset=utf8", 'root', 'root', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    
    // Add column if not exists (safe to run multiple times)
    $pdo->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS tutorial_done TINYINT(1) NOT NULL DEFAULT 0");
    
    $stmt = $pdo->prepare("UPDATE users SET tutorial_done = 1 WHERE id = ?");
    $stmt->execute([$userId]);
    
    echo json_encode(['success'=>true]);
} catch (Exception $e) {
    echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
}