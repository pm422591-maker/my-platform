<?php
// Спільний модуль: CORS + налаштування сесії
// Підключати: require_once __DIR__ . '/cors_session.php';

$allowedOrigins = [
    'https://syncora.cyou',
    'https://www.syncora.cyou',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: https://syncora.cyou");
}
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// На хостингу завжди HTTPS
$isSecure = true;

session_set_cookie_params([
    'lifetime' => 86400,
    'path'     => '/',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'None',
]);
