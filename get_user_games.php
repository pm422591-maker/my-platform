<?php
header('Content-Type: application/json');
session_start();
$host = 'my-mysql'; $db = 'mywebsite'; $user = 'root'; $pass = 'root';

if (!isset($_SESSION['user_id'])) { echo json_encode([]); exit; }

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
// Важливо: FETCH_ASSOC, щоб отримати масив з ключами game_name та is_muted
$stmt = $pdo->prepare("SELECT game_name, is_muted FROM user_games WHERE user_id = ?");
$stmt->execute([$_SESSION['user_id']]);
$games = $stmt->fetchAll(PDO::FETCH_ASSOC); 
echo json_encode($games);