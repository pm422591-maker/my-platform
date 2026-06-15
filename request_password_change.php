<?php
// request_password_change.php — крок 1: користувач хоче змінити пароль.
// Надсилаємо лист з посиланням підтвердження на його email.

require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/security_lib.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Увійдіть на сайт.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$newPassword = $input['new_password'] ?? '';

if (strlen($newPassword) < 6) {
    echo json_encode(['success' => false, 'message' => 'Пароль має містити щонайменше 6 символів.']);
    exit;
}
if (strlen($newPassword) > 200) {
    echo json_encode(['success' => false, 'message' => 'Пароль задовгий.']);
    exit;
}

try {
    $pdo = sec_pdo();
    sec_ensure_schema($pdo);

    $userId = (int)$_SESSION['user_id'];

    // Дістаємо email користувача
    $stmt = $pdo->prepare("SELECT email, username FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || empty($user['email'])) {
        echo json_encode(['success' => false, 'message' => 'У акаунта не вказано email.']);
        exit;
    }

    // Генеруємо токен; зберігаємо новий пароль (хеш) разом з токеном
    $token   = bin2hex(random_bytes(32));
    $expires = (new DateTime('+30 minutes'))->format('Y-m-d H:i:s');
    $hash    = password_hash($newPassword, PASSWORD_DEFAULT);

    // Інвалідовуємо старі невикористані токени цього юзера
    $pdo->prepare("UPDATE password_change_tokens SET used = 1 WHERE user_id = ? AND used = 0")
        ->execute([$userId]);

    // Зберігаємо хеш пароля у тимчасовому полі токена (додаємо колонку якщо немає)
    try { $pdo->exec("ALTER TABLE password_change_tokens ADD COLUMN pending_hash VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}

    $stmt = $pdo->prepare("INSERT INTO password_change_tokens (user_id, token, expires_at, pending_hash)
                           VALUES (?, ?, ?, ?)");
    $stmt->execute([$userId, $token, $expires, $hash]);

    // Формуємо посилання підтвердження
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'https';
    $host   = $_SERVER['HTTP_HOST'] ?? 'syncora.cyou';
    $link   = "{$scheme}://{$host}/confirm_password_change.php?token={$token}";

    $safeName = htmlspecialchars($user['username'] ?? 'користувач', ENT_QUOTES, 'UTF-8');
    $body = "
    <div style='font-family:Arial,sans-serif;max-width:480px;margin:auto;background:#1d0016;border-radius:16px;overflow:hidden;border:1px solid rgba(255,37,187,0.3);'>
      <div style='background:linear-gradient(135deg,#FF25BB,#b0356a);padding:24px;text-align:center;'>
        <h1 style='color:#fff;margin:0;font-size:22px;letter-spacing:1px;'>SYNCORA</h1>
      </div>
      <div style='padding:28px;color:#eee;'>
        <p style='font-size:15px;'>Привіт, <b>{$safeName}</b>!</p>
        <p style='font-size:14px;line-height:1.6;color:#ccc;'>
          Ми отримали запит на зміну пароля до твого акаунта. Щоб підтвердити зміну, натисни кнопку нижче.
          Посилання дійсне 30 хвилин.
        </p>
        <div style='text-align:center;margin:28px 0;'>
          <a href='{$link}' style='display:inline-block;background:linear-gradient(135deg,#FF25BB,#b0356a);color:#fff;text-decoration:none;padding:14px 38px;border-radius:12px;font-weight:bold;font-size:15px;'>Підтвердити зміну пароля</a>
        </div>
        <p style='font-size:12px;color:#888;line-height:1.6;'>
          Якщо це був не ти — просто проігноруй цей лист, пароль залишиться без змін.
        </p>
      </div>
    </div>";

    $mailErr = '';
    $sent = sec_send_mail($user['email'], 'Підтвердження зміни пароля — Syncora', $body, $mailErr);

    if ($sent) {
        // Маскуємо email для відповіді
        $parts = explode('@', $user['email']);
        $masked = substr($parts[0], 0, 2) . '***@' . ($parts[1] ?? '');
        echo json_encode(['success' => true, 'message' => "Лист надіслано на {$masked}. Перевір пошту."]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Не вдалося надіслати лист.',
            'detail'  => $mailErr   // конкретна причина (для діагностики)
        ]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Помилка сервера.']);
}