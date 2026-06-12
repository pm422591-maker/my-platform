<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode([]);
    exit;
}

$current_user_id = (int)$_SESSION['user_id'];

try {
    // Вибираємо всі гіфки користувача
    $stmt = $pdo->prepare(
        "SELECT gif_url FROM user_favorites WHERE user_id = ? ORDER BY id DESC"
    );
    $stmt->execute([$current_user_id]);

    // Повертаємо тільки масив посилань
    $favorites = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode($favorites);

} catch (Exception $e) {
    error_log('[get_favorites] DB error: ' . $e->getMessage());
    echo json_encode([]);
}