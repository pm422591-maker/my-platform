<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';

$data = json_decode(file_get_contents("php://input"), true);
$target_id = isset($data['target_id']) ? (int)$data['target_id'] : 0;
$delete_type = isset($data['delete_type']) ? $data['delete_type'] : ''; // 'me' або 'both'

if (!isset($_SESSION['user_id']) || $target_id === 0 || !in_array($delete_type, ['me', 'both'])) {
    echo json_encode(['success' => false, 'message' => 'Некоректні дані']);
    exit;
}

$my_id = (int)$_SESSION['user_id'];

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // 1. СТВОРЮЄМО КОЛОНКУ deleted_by, ЯКЩО ЇЇ ЩЕ НЕМАЄ В ТАБЛИЦІ MESSAGES
    // (Робиться лише один раз, далі помилка ігноруватиметься)
    try {
        $pdo->exec("ALTER TABLE messages ADD COLUMN deleted_by INT DEFAULT NULL");
    } catch (PDOException $e) {
        // Колонка вже є, ідемо далі
    }

    if ($delete_type === 'both') {
        // === ВИДАЛИТИ В ОБОХ ===
        // Повністю стираємо всі повідомлення між цими двома людьми
        $stmt = $pdo->prepare("
            DELETE FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?)
        ");
        $stmt->execute([$my_id, $target_id, $target_id, $my_id]);
        
    } else if ($delete_type === 'me') {
        // === ВИДАЛИТИ ТІЛЬКИ У МЕНЕ ===
        
        // 1. Якщо співрозмовник ВЖЕ видалив ці повідомлення для себе (deleted_by = target_id),
        // і тепер я теж видаляю для себе — значить повідомлення більше нікому не потрібні. Видаляємо повністю!
        $stmt_del = $pdo->prepare("
            DELETE FROM messages 
            WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
              AND deleted_by = ?
        ");
        $stmt_del->execute([$my_id, $target_id, $target_id, $my_id, $target_id]);

        // 2. Для всіх інших повідомлень просто ставимо позначку, що Я їх видалив
        $stmt_update = $pdo->prepare("
            UPDATE messages 
            SET deleted_by = ? 
            WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
              AND deleted_by IS NULL
        ");
        $stmt_update->execute([$my_id, $my_id, $target_id, $target_id, $my_id]);
    }

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>