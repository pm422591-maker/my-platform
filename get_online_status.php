<?php
header('Content-Type: application/json; charset=utf-8');

error_reporting(0);
ini_set('display_errors', 0);

// --- ЄДИНЕ НАЛАШТУВАННЯ ПІДКЛЮЧЕННЯ ---
$host = 'my-mysql';
$db   = 'mywebsite';
$user = 'root';
$pass = 'root';

if(isset($_GET['user_id'])) {
    try {
        $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]);
        
        $profile_id = $_GET['user_id'];
        
        // МАГИЯ ЗДЕСЬ: Считаем разницу прямо в базе данных!
        // Это полностью исключает ошибки часовых поясов Docker
        $sql = "SELECT TIMESTAMPDIFF(SECOND, last_active, NOW()) as seconds_offline FROM users WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $profile_id]);
        $user_data = $stmt->fetch();

        $is_online = false;
        
        // Переверяем: если секунд оффлайн меньше 300 (5 минут) и не отрицательное число
        if($user_data && $user_data['seconds_offline'] !== null) {
            $seconds = (int)$user_data['seconds_offline'];
            if($seconds <= 300 && $seconds >= 0) {
                $is_online = true;
            }
        }
        
        // Отдаем ответ
        echo json_encode(['online' => $is_online]);
        
    } catch (Exception $e) {
        echo json_encode(['online' => false]);
    }
} else {
    echo json_encode(['online' => false]);
}
?>