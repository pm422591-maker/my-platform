<?php
// confirm_password_change.php — крок 2: користувач перейшов за посиланням з листа.
// Застосовуємо новий пароль.

require_once __DIR__ . '/security_lib.php';

$token = $_GET['token'] ?? '';
$ok = false;
$msg = '';

if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
    $msg = 'Невірне посилання.';
} else {
    try {
        $pdo = sec_pdo();
        sec_ensure_schema($pdo);

        $stmt = $pdo->prepare("SELECT * FROM password_change_tokens WHERE token = ? LIMIT 1");
        $stmt->execute([$token]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            $msg = 'Посилання не знайдено.';
        } elseif ((int)$row['used'] === 1) {
            $msg = 'Це посилання вже використано.';
        } elseif (new DateTime() > new DateTime($row['expires_at'])) {
            $msg = 'Термін дії посилання минув. Запроси зміну ще раз.';
        } elseif (empty($row['pending_hash'])) {
            $msg = 'Дані для зміни пароля втрачено. Спробуй ще раз.';
        } else {
            // Застосовуємо новий пароль
            $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")
                ->execute([$row['pending_hash'], $row['user_id']]);
            $pdo->prepare("UPDATE password_change_tokens SET used = 1 WHERE id = ?")
                ->execute([$row['id']]);
            $ok = true;
            $msg = 'Пароль успішно змінено! Тепер можеш увійти з новим паролем.';
        }
    } catch (Exception $e) {
        $msg = 'Помилка сервера.';
    }
}

$color = $ok ? '#3ad17a' : '#FF25BB';
$icon  = $ok ? '✓' : '!';
?>
<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Зміна пароля — Syncora</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:radial-gradient(circle at 50% 30%, #2a0020, #0a0008); font-family:Arial, sans-serif; }
  .box { background:rgba(29,0,22,0.9); border:1px solid rgba(255,37,187,0.3); border-radius:20px;
         padding:40px 32px; max-width:420px; width:90%; text-align:center;
         box-shadow:0 0 40px rgba(255,37,187,0.25); }
  .circle { width:64px; height:64px; border-radius:50%; margin:0 auto 20px;
            display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:bold;
            color:#fff; background:<?= $color ?>; box-shadow:0 0 24px <?= $color ?>88; }
  h1 { color:#fff; font-size:20px; margin:0 0 10px; }
  p  { color:#ccc; font-size:14px; line-height:1.6; margin:0 0 24px; }
  a.btn { display:inline-block; background:linear-gradient(135deg,#FF25BB,#b0356a); color:#fff;
          text-decoration:none; padding:12px 34px; border-radius:12px; font-weight:bold; }
</style>
</head>
<body>
  <div class="box">
    <div class="circle"><?= $icon ?></div>
    <h1><?= $ok ? 'Готово' : 'Не вдалося' ?></h1>
    <p><?= htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') ?></p>
    <a class="btn" href="/home.html">На головну</a>
  </div>
</body>
</html>