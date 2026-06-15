<?php
// get_sessions.php — список активних сесій (пристроїв) користувача + статус 2FA.

require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/security_lib.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Увійдіть на сайт.']);
    exit;
}

$userId = (int)$_SESSION['user_id'];

try {
    $pdo = sec_pdo();
    sec_ensure_schema($pdo);

    // Реєструємо/оновлюємо поточну сесію
    sec_track_session($pdo, $userId);

    $currentToken = $_SESSION['device_token'] ?? '';

    // Прибираємо «протухлі» сесії (не активні понад 30 днів)
    $pdo->prepare("DELETE FROM user_sessions WHERE user_id = ? AND last_active < (NOW() - INTERVAL 30 DAY)")
        ->execute([$userId]);

    $stmt = $pdo->prepare("SELECT id, ip, city, country, os, browser, created_at, last_active, session_token
                           FROM user_sessions WHERE user_id = ? ORDER BY last_active DESC");
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sessions = [];
    foreach ($rows as $r) {
        $isCurrent = hash_equals($currentToken, $r['session_token']);
        $location = trim(($r['city'] ?? '') . (($r['city'] && $r['country']) ? ', ' : '') . ($r['country'] ?? ''));
        $sessions[] = [
            'id'          => (int)$r['id'],
            'os'          => $r['os'] ?: 'Невідомо',
            'browser'     => $r['browser'] ?: 'Невідомо',
            'ip'          => $r['ip'] ?: '—',
            'city'        => $r['city'] ?: 'Невідоме місто',
            'country'     => $r['country'] ?: '',
            'location'    => $location !== '' ? $location : 'Невідоме розташування',
            'created_at'  => $r['created_at'],
            'last_active' => $r['last_active'],
            'is_current'  => $isCurrent,
        ];
    }

    // Статус 2FA
    $stmt = $pdo->prepare("SELECT two_factor_enabled FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $twoFa = (int)($stmt->fetchColumn() ?: 0);

    echo json_encode([
        'success'  => true,
        'sessions' => $sessions,
        'two_factor_enabled' => $twoFa === 1,
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка сервера.']);
}