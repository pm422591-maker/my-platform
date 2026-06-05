<?php
// add_tutorial_coins.php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Включаем отображение ошибок для отладки, если что-то пойдет не так
ini_set('display_errors', 1);
error_reporting(E_ALL);

$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Ошибка подключения к БД: ' . $e->getMessage()]);
    exit;
}

// Проверяем, авторизован ли пользователь (через сессию вашего приложения)
// (Если у вас юзер хранится под другим ключом, например $_SESSION['user_id'], замените его ниже)
if (!isset($_SESSION['username'])) {
    echo json_encode(['success' => false, 'message' => 'Пользователь не авторизован в сессии.']);
    exit;
}

$current_username = $_SESSION['username'];
$reward_coins = 100; // Сколько коинов даем за прохождение обучения

try {
    // 1. Проверяем, есть ли уже у пользователя колонка для коинов (динамически страхуемся)
    // Убедитесь, что в вашей таблице users есть колонка `coins` (INT DEFAULT 0)
    
    // 2. Обновляем коины текущему пользователю
    $stmt = $pdo->prepare("UPDATE users SET coins = coins + :reward WHERE username = :username");
    $stmt->execute(['reward' => $reward_coins, 'username' => $current_username]);

    // 3. Получаем новый актуальный баланс коинов из базы данных
    $stmtBalance = $pdo->prepare("SELECT coins FROM users WHERE username = :username");
    $stmtBalance->execute(['username' => $current_username]);
    $userRow = $stmtBalance->fetch();
    
    $new_balance = $userRow ? $userRow['coins'] : 0;

    echo json_encode([
        'success' => true, 
        'message' => 'Коины успешно зачислены!',
        'added' => $reward_coins,
        'new_balance' => $new_balance
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Ошибка выполнения SQL: ' . $e->getMessage()]);
}
?>