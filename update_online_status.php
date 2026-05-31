<?php
session_start();

// Вимикаємо вивід помилок, щоб не ламати запити
error_reporting(0);
ini_set('display_errors', 0);

// --- ЄДИНЕ НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ---
$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

if(isset($_SESSION['user_id'])) {
    try {
        $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]);
        
        // Оновлюємо час останньої активності (пульс)
        $sql = "UPDATE users SET last_active = NOW() WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $_SESSION['user_id']]);
        
    } catch (Exception $e) {
        // Ігноруємо помилки пульсу
    }
}
?>