<?php
// claim_badge.php — видача "залоченого" бейджа після ПЕРЕВІРКИ завдання на сервері.
// Клієнт НЕ може просто сказати "я виконав" — ми рахуємо реальні дані з БД.
require_once __DIR__ . '/cors_session.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

session_start();
error_reporting(0);
ini_set('display_errors', 0);

$userId = $_SESSION['user_id'] ?? null;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Не авторизовано']);
    exit;
}
$userId = (int)$userId;

require_once __DIR__ . '/db_connect.php';

// ── Опис завдань для кожного бейджа ──
// type 'comments' / 'posts' рахуються автоматично з БД.
// 'vip' — стартовий безкоштовний бейдж, його не "клеймлять" тут.
$BADGE_TASKS = [
    'verified'   => ['type' => 'comments', 'goal' => 10, 'title' => 'Активний коментатор',
                     'desc' => 'Напишіть 10 коментарів'],
    'creative'   => ['type' => 'posts',    'goal' => 10, 'title' => 'Автор контенту',
                     'desc' => 'Створіть 10 постів'],
    'bug_hunter' => ['type' => 'comments', 'goal' => 50, 'title' => 'Мисливець за багами',
                     'desc' => 'Напишіть 50 коментарів'],
    'admin'      => ['type' => 'posts',    'goal' => 25, 'title' => 'Лідер спільноти',
                     'desc' => 'Створіть 25 постів'],
];

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$badge = trim($input['badge'] ?? '');

if (!isset($BADGE_TASKS[$badge])) {
    echo json_encode(['success' => false, 'message' => 'Невідомий бейдж']);
    exit;
}

$task = $BADGE_TASKS[$badge];

try {
    // Гарантуємо наявність колонки owned_badges
    $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('owned_badges', $cols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN owned_badges TEXT NULL");
    }

    // 1. Поточний прогрес з БД
    $progress = 0;
    if ($task['type'] === 'comments') {
        $st = $pdo->prepare("SELECT COUNT(*) FROM comments WHERE user_id = ?");
        $st->execute([$userId]);
        $progress = (int)$st->fetchColumn();
    } elseif ($task['type'] === 'posts') {
        $st = $pdo->prepare("SELECT COUNT(*) FROM posts WHERE user_id = ?");
        $st->execute([$userId]);
        $progress = (int)$st->fetchColumn();
    }

    // 2. Перевірка виконання
    if ($progress < $task['goal']) {
        echo json_encode([
            'success'  => false,
            'message'  => 'Завдання ще не виконано',
            'progress' => $progress,
            'goal'     => $task['goal']
        ]);
        exit;
    }

    // 3. Дістаємо вже отримані бейджі
    $st = $pdo->prepare("SELECT owned_badges FROM users WHERE id = ?");
    $st->execute([$userId]);
    $owned = trim((string)$st->fetchColumn());
    $ownedArr = $owned === '' ? [] : array_filter(array_map('trim', explode(',', $owned)));

    if (in_array($badge, $ownedArr, true)) {
        echo json_encode([
            'success'        => true,
            'already_owned'  => true,
            'badge'          => $badge,
            'owned_badges'   => implode(',', $ownedArr)
        ]);
        exit;
    }

    // 4. Додаємо бейдж
    $ownedArr[] = $badge;
    $newOwned = implode(',', $ownedArr);
    $pdo->prepare("UPDATE users SET owned_badges = ? WHERE id = ?")
        ->execute([$newOwned, $userId]);

    echo json_encode([
        'success'       => true,
        'already_owned' => false,
        'badge'         => $badge,
        'title'         => $task['title'],
        'owned_badges'  => $newOwned
    ]);

} catch (Exception $e) {
    error_log('[claim_badge] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}
