<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо вивід помилок у текст, щоб не ламати JSON
error_reporting(0); 
ini_set('display_errors', 0);

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql';  // Виправлено з 127.0.0.1
$db   = 'mywebsite'; // Перевір назву бази (mywebsite або gamer_db)
$user = getenv('DB_USER') ?: 'appuser';
$pass = getenv('DB_PASS') ?: '';      // Пароль для Docker

// 1. Перевірка авторизації
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}

// 2. Отримання даних (JSON)
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

// Якщо прийшов пустий масив або null, робимо пустий масив
$badges = $input['badges'] ?? [];

// 3. Валідація
if (!is_array($badges)) {
    echo json_encode(['success' => false, 'message' => 'Дані мають бути масивом']);
    exit;
}

if (count($badges) > 5) {
    echo json_encode(['success' => false, 'message' => 'Максимум 5 бейджів']);
    exit;
}

try {
    // 4. Підключення до БД (Виправлено)
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // 5. Перетворення масиву в рядок (vip,admin,verified)
    // Очищаємо дані від зайвого сміття
    $cleanBadges = array_values(array_filter(array_map('trim', $badges), fn($b) => $b !== ''));

    // 5b. Дозволяємо відображати ЛИШЕ ті бейджі, якими користувач реально володіє.
    // 'vip' — стартовий безкоштовний бейдж, він завжди дозволений.
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
        $ownedStr = '';
        if (in_array('owned_badges', $cols)) {
            $st = $pdo->prepare("SELECT owned_badges FROM users WHERE id = ?");
            $st->execute([$_SESSION['user_id']]);
            $ownedStr = (string)$st->fetchColumn();
        }
        $ownedArr = array_filter(array_map('trim', explode(',', $ownedStr)));
        $ownedArr[] = 'vip'; // стартовий бейдж завжди доступний
        $cleanBadges = array_values(array_intersect($cleanBadges, $ownedArr));
    } catch (Exception $e) {
        // якщо колонки немає — лишаємо тільки стартовий
        $cleanBadges = array_values(array_intersect($cleanBadges, ['vip']));
    }

    $badgesString = implode(',', $cleanBadges);
    
    // Якщо рядок пустий - записуємо NULL
    if (empty($badgesString)) {
        $badgesString = null;
    }

    // 6. Запис у БД
    $stmt = $pdo->prepare("UPDATE users SET badges = ? WHERE id = ?");
    $stmt->execute([$badgesString, $_SESSION['user_id']]);

    echo json_encode(['success' => true, 'saved_badges' => $badgesString]);

} catch (Exception $e) {
    // Повертаємо помилку у форматі JSON
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка БД: ' . $e->getMessage()]);
}
?>