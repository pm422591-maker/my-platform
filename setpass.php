<?php
require __DIR__ . '/db_connect.php';

$newPassword = 'Polina12345';   // пароль, которым будешь входить
$userId = 7;

$hash = password_hash($newPassword, PASSWORD_DEFAULT);

$stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
$stmt->execute([$hash, $userId]);

// Сразу проверяем, что записанный хеш совпадает с паролём
$check = $pdo->prepare("SELECT password FROM users WHERE id = ?");
$check->execute([$userId]);
$row = $check->fetch();

echo "rows affected: " . $stmt->rowCount() . "<br>";
echo "verify: ";
var_dump(password_verify($newPassword, $row['password']));