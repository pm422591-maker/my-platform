<?php
require __DIR__.'/db_connect.php';
$stmt = $pdo->prepare("SELECT password FROM users WHERE id = 7");
$stmt->execute();
$row = $stmt->fetch();
var_dump(password_verify('Polina12345', $row['password']));