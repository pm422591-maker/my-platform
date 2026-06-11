<?php
header('Content-Type: application/json');
session_start();
$host = 'my-mysql'; $db = 'mywebsite'; $user = getenv('DB_USER') ?: 'appuser'; $pass = getenv('DB_PASS') ?: '';

if (!isset($_SESSION['user_id'])) { echo json_encode([]); exit; }

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
$stmt = $pdo->prepare("SELECT roblox_id, steam_id, epic_id FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

$my_accounts = [];
// Якщо поле не пусте, значить акаунт прив'язаний
if (!empty($row['roblox_id'])) $my_accounts[] = 'Roblox';
if (!empty($row['steam_id'])) $my_accounts[] = 'Steam';
if (!empty($row['epic_id'])) $my_accounts[] = 'Epic Games';

// Віддаємо простий масив, наприклад: ['Roblox', 'Steam']
echo json_encode($my_accounts);
?>