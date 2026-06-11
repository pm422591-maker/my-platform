<?php
// cors_session.php — ЗАХИЩЕНА ВЕРСІЯ
// CORS + Security Headers + Rate Limiting

$allowedOrigins = [
    'https://syncora.cyou',
    'https://www.syncora.cyou',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: https://syncora.cyou");
}
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");

// ═══════════════════════════════════════════
// SECURITY HEADERS — захист від XSS, clickjacking тощо
// ═══════════════════════════════════════════
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");
header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
// CSP — дозволяємо тільки свій домен
header("Content-Security-Policy: default-src 'self' https://syncora.cyou; script-src 'self' https://syncora.cyou 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://syncora.cyou");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ═══════════════════════════════════════════
// RATE LIMITING — захист від brute-force
// Зберігаємо лічильник у сесійному файлі (без Redis)
// ═══════════════════════════════════════════
function checkRateLimit(string $key, int $maxRequests = 60, int $windowSeconds = 60): bool {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP']   // якщо Cloudflare
        ?? $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['REMOTE_ADDR'];

    $ip = trim(explode(',', $ip)[0]); // беремо перший IP якщо є список

    $cacheDir = sys_get_temp_dir() . '/rl_syncora/';
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0700, true);
    }

    $file = $cacheDir . md5($key . '_' . $ip) . '.json';
    $now  = time();

    $data = [];
    if (file_exists($file)) {
        $raw = file_get_contents($file);
        $data = json_decode($raw, true) ?: [];
    }

    // Видаляємо старі записи
    $data = array_filter($data, fn($t) => ($now - $t) < $windowSeconds);

    if (count($data) >= $maxRequests) {
        return false; // ліміт перевищено
    }

    $data[] = $now;
    file_put_contents($file, json_encode(array_values($data)), LOCK_EX);
    return true;
}

// ═══════════════════════════════════════════
// SESSION CONFIG — безпечні cookie
// ═══════════════════════════════════════════
session_set_cookie_params([
    'lifetime' => 86400,
    'path'     => '/',
    'domain'   => '.syncora.cyou',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'None',
]);
