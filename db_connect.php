<?php
// Ми НЕ викликаємо тут session_start(), бо цей файл будемо інклюдити в інші скрипти
// Ми НЕ вимикаємо помилки тут (error_reporting), щоб у разі проблем бачити їх у консолі

$host = 'my-mysql'; // Назва сервісу в Docker
$db   = 'mywebsite';
$user = 'root';
$pass = 'root'; // Згідно з вашим прикладом, тут пароль 'root'
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
    // Якщо підключення не вдалося, віддаємо JSON, щоб JS не "падав"
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false, 
        'message' => 'Помилка підключення: ' . $e->getMessage()
    ]);
    exit;
}
?>