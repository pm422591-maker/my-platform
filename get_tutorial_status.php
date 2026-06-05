<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// Use same session params as login.php / register.php
$isSecure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
$isSecure = true; // Match register.php setting

session_set_cookie_params([
    'lifetime' => 86400,
    'path' => '/',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'None'
]);
session_start();

$userId = $_SESSION['user_id'] ?? null;

// Debug: log session state
error_log("[get_tutorial_status] session_id=" . session_id() . " user_id=" . ($userId ?? 'null'));

if (!$userId) {
    echo json_encode(['success' => false, 'tutorial_done' => false, 'reason' => 'no_session']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=my-mysql;dbname=mywebsite;charset=utf8", 'root', 'root', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    
    try {
        $stmt = $pdo->prepare("SELECT tutorial_done FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $done = $row && isset($row['tutorial_done']) && $row['tutorial_done'] == 1;
    } catch (Exception $inner) {
        // Column doesn't exist yet — not done
        error_log("[get_tutorial_status] column error: " . $inner->getMessage());
        $done = false;
    }
    
    echo json_encode(['success' => true, 'tutorial_done' => $done, 'user_id' => $userId]);
} catch (Exception $e) {
    error_log("[get_tutorial_status] DB error: " . $e->getMessage());
    echo json_encode(['success' => false, 'tutorial_done' => false, 'message' => $e->getMessage()]);
}