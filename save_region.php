<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// Вимикаємо вивід помилок у текст, щоб не ламати JSON
error_reporting(0); 
ini_set('display_errors', 0);

// --- НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ (DOCKER) ---
$host = 'my-mysql'; // В Docker використовуємо назву контейнера, а не 127.0.0.1
$db   = 'mywebsite'; // Перевір у phpMyAdmin: можливо тут має бути 'gamer_db'?
$user = 'root';      
$pass = 'root';      // У Docker пароль зазвичай 'root'

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Перевірка авторизації
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Користувач не авторизований']);
        exit;
    }

    $userId = $_SESSION['user_id'];
    
    // Отримуємо "сирі" дані JSON
    $inputJSON = file_get_contents('php://input');
    $input = json_decode($inputJSON, true);

    // 1. Отримуємо країну
    $country = $input['country'] ?? null;

    // 2. Отримуємо мови
    $rawLanguages = $input['languages'] ?? ''; 

    // Обробка масиву мов
    if (is_string($rawLanguages)) {
        // Якщо прийшов рядок "GB,FR" -> розбиваємо в масив
        $languagesArray = explode(',', $rawLanguages);
    } elseif (is_array($rawLanguages)) {
        $languagesArray = $rawLanguages;
    } else {
        $languagesArray = [];
    }

    // Очищуємо від зайвих пробілів та порожніх значень
    $languagesArray = array_map('trim', $languagesArray);
    $languagesArray = array_filter($languagesArray); 
    
    // Прибираємо дублікати (наприклад, якщо двічі вибрали EN)
    $languagesArray = array_unique($languagesArray);

    // Обмежуємо до 4 мов
    if (count($languagesArray) > 4) {
        $languagesArray = array_slice($languagesArray, 0, 4);
    }

    // Збираємо назад у рядок для запису в БД (наприклад: "GB,FR")
    $languagesString = !empty($languagesArray) ? implode(',', $languagesArray) : null;

    // Оновлюємо базу
    $stmt = $pdo->prepare("UPDATE users SET country_code = ?, languages_icons = ? WHERE id = ?");
    $stmt->execute([$country, $languagesString, $userId]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    // Якщо помилка підключення або запиту
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Помилка бази даних: ' . $e->getMessage()]);
}
?>