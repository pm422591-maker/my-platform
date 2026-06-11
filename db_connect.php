<?php
// db_connect.php — ЗАХИЩЕНА ВЕРСІЯ
// Credentials читаються з environment variables, НЕ з коду

$host    = getenv('DB_HOST')    ?: 'my-mysql';
$db      = getenv('DB_NAME')    ?: 'mywebsite';
$user    = getenv('DB_USER')    ?: 'appuser';      // НЕ root!
$pass    = getenv('DB_PASS')    ?: '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    // НІКОЛИ не показуємо деталі помилки клієнту!
    error_log('DB connection failed: ' . $e->getMessage());
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Помилка сервера. Спробуйте пізніше.']);
    exit;
}
