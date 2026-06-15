<?php
// set_2fa.php — увімкнення/вимкнення двофакторної автентифікації (4-значний PIN).
// PIN зберігається ХЕШОВАНИМ, не у відкритому вигляді.

require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/security_lib.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Увійдіть на сайт.']);
    exit;
}

$input  = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? '';   // 'enable' | 'disable'
$pin    = (string)($input['pin'] ?? '');
$userId = (int)$_SESSION['user_id'];

try {
    $pdo = sec_pdo();
    sec_ensure_schema($pdo);

    if ($action === 'enable') {
        // Рівно 4 цифри
        if (!preg_match('/^\d{4}$/', $pin)) {
            echo json_encode(['success' => false, 'message' => 'PIN має складатися рівно з 4 цифр.']);
            exit;
        }
        $hash = password_hash($pin, PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE users SET two_factor_enabled = 1, two_factor_pin = ? WHERE id = ?")
            ->execute([$hash, $userId]);
        echo json_encode(['success' => true, 'enabled' => true, 'message' => 'Двофакторну автентифікацію увімкнено.']);

    } elseif ($action === 'disable') {
        $pdo->prepare("UPDATE users SET two_factor_enabled = 0, two_factor_pin = NULL WHERE id = ?")
            ->execute([$userId]);
        echo json_encode(['success' => true, 'enabled' => false, 'message' => 'Двофакторну автентифікацію вимкнено.']);

    } else {
        echo json_encode(['success' => false, 'message' => 'Невідома дія.']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка сервера.']);
}